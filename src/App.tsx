/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, RotateCcw, BookOpen, Volume2, 
  Info, ChevronLeft, ChevronRight, Search, 
  Menu, X, Sparkles, Loader2 
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---
interface BibleVerse {
  id: string | number;
  reference: string;
  english: string;
  pronunciation: string;
  meaning: string;
  wordMeanings: Record<string, string>;
}

// --- Constants ---
const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians",
  "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter",
  "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

const INITIAL_VERSES: BibleVerse[] = [
  {
    id: 1,
    reference: "Proverbs 1:7",
    english: "The fear of the LORD is the beginning of knowledge, but fools despise wisdom and instruction.",
    pronunciation: "더 피어 오브 더 로드 이즈 더 비기닝 오브 날리지, 벗 풀스 디스파이즈 위즈덤 앤 인스트럭션.",
    meaning: "여호와를 경외하는 것이 지식의 근본이어늘 미련한 자는 지혜와 훈계를 멸시하느니라.",
    wordMeanings: {
      "fear": "경외, 두려움 (하나님에 대한 거룩한 존경심)",
      "LORD": "여호와, 주님 (스스로 계신 분)",
      "beginning": "시작, 근본",
      "knowledge": "지식, 깨달음",
      "fools": "미련한 자, 어리석은 자",
      "despise": "멸시하다, 가볍게 여기다",
      "wisdom": "지혜 (하나님의 관점으로 세상을 보는 능력)",
      "instruction": "훈계, 교훈"
    }
  },
  {
    id: 2,
    reference: "Proverbs 16:9",
    english: "In their hearts humans plan their course, but the LORD establishes their steps.",
    pronunciation: "인 데어 하츠 휴먼스 플랜 데어 코스, 벗 더 로드 이스태블리시스 데어 스텝스.",
    meaning: "사람이 마음으로 자기의 길을 계획할지라도 그의 걸음을 인도하시는 이는 여호와시니라.",
    wordMeanings: {
      "hearts": "마음, 중심",
      "humans": "사람, 인간",
      "plan": "계획하다",
      "course": "길, 방향",
      "establishes": "세우다, 확정하다, 인도하다",
      "steps": "걸음, 발걸음"
    }
  }
];

// --- Components ---

const Toast = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
    className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-stone-800 text-stone-100 px-6 py-3 rounded-full shadow-2xl z-[60] flex items-center gap-3 border border-stone-700 w-[90%] max-w-sm"
  >
    <Info className="w-4 h-4 text-amber-400 shrink-0" />
    <span className="text-xs sm:text-sm font-medium truncate">{message}</span>
    <button onClick={onClose} className="ml-auto hover:text-white transition-colors p-1">
      <X className="w-4 h-4" />
    </button>
  </motion.div>
);

export default function App() {
  const [verses, setVerses] = useState<BibleVerse[]>(INITIAL_VERSES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRepeating, setIsRepeating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const currentVerse = verses[currentIndex];
  const aiRef = useRef<GoogleGenAI | null>(null);
  const repeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize AI
  useEffect(() => {
    if (process.env.GEMINI_API_KEY) {
      aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  }, []);

  // TTS Logic with better mobile support
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) {
      setToastMessage("TTS is not supported on this browser.");
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (onEnd) onEnd();
    };
    utterance.onerror = (event) => {
      console.error("TTS Error:", event);
      setIsSpeaking(false);
    };

    // Mobile browsers often require a user gesture to start speech
    // This function should be called directly from an onClick handler
    window.speechSynthesis.speak(utterance);
  }, []);

  // Handle Repeat Logic
  useEffect(() => {
    if (isRepeating && !isSpeaking && currentVerse) {
      // Small delay before repeating to make it feel natural
      repeatTimeoutRef.current = setTimeout(() => {
        speak(currentVerse.english);
      }, 1000);
    }
    return () => {
      if (repeatTimeoutRef.current) clearTimeout(repeatTimeoutRef.current);
    };
  }, [isRepeating, isSpeaking, currentVerse, speak]);

  const toggleRepeat = () => {
    if (isRepeating) {
      setIsRepeating(false);
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      setIsRepeating(true);
      if (currentVerse) speak(currentVerse.english);
    }
  };

  const handleManualSpeak = () => {
    if (currentVerse) speak(currentVerse.english);
  };

  const handleWordClick = (word: string) => {
    const cleanWord = word.replace(/[.,!?;:]/g, "");
    const meaning = currentVerse.wordMeanings[cleanWord as keyof typeof currentVerse.wordMeanings] || 
                    currentVerse.wordMeanings[cleanWord.toLowerCase() as keyof typeof currentVerse.wordMeanings];
    
    if (meaning) {
      setToastMessage(`${cleanWord}: ${meaning}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || !aiRef.current) return;

    setIsLoading(true);
    try {
      const response = await aiRef.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find the Bible verse for "${searchQuery}". Provide the English text, Korean phonetic pronunciation, Korean meaning, and a dictionary of key words and their biblical meanings.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reference: { type: Type.STRING },
              english: { type: Type.STRING },
              pronunciation: { type: Type.STRING },
              meaning: { type: Type.STRING },
              wordMeanings: {
                type: Type.OBJECT,
                additionalProperties: { type: Type.STRING }
              }
            },
            required: ["reference", "english", "pronunciation", "meaning", "wordMeanings"]
          }
        }
      });

      const result = JSON.parse(response.text);
      const newVerse: BibleVerse = {
        id: Date.now(),
        ...result
      };

      setVerses([newVerse, ...verses]);
      setCurrentIndex(0);
      setIsSearchOpen(false);
      setSearchQuery("");
      window.speechSynthesis.cancel();
      setIsRepeating(false);
      setIsSpeaking(false);
    } catch (error) {
      console.error("Search failed:", error);
      setToastMessage("Could not find that verse. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const nextVerse = () => {
    window.speechSynthesis.cancel();
    setIsRepeating(false);
    setIsSpeaking(false);
    setCurrentIndex((prev) => (prev + 1) % verses.length);
  };

  const prevVerse = () => {
    window.speechSynthesis.cancel();
    setIsRepeating(false);
    setIsSpeaking(false);
    setCurrentIndex((prev) => (prev - 1 + verses.length) % verses.length);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-stone-900 font-sans selection:bg-amber-100 overflow-x-hidden flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-[#f5f5f0]/90 backdrop-blur-md z-40 py-4 sm:py-6 px-4 sm:px-6 border-b border-stone-200/50">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 hover:bg-stone-200 rounded-full transition-colors active:scale-90"
            >
              <Menu className="w-5 h-5 text-stone-600" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-stone-400" />
              <h1 className="text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] font-bold text-stone-500 whitespace-nowrap">Eternal Word</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-stone-200 rounded-full text-stone-400 hover:border-stone-400 transition-all shadow-sm active:scale-95"
            >
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="text-[10px] sm:text-xs font-medium hidden xs:inline">Search...</span>
            </button>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-stone-400">
              {currentIndex + 1}/{verses.length}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto pt-24 sm:pt-32 px-4 sm:px-6 pb-40 flex flex-col justify-center w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentIndex}-${verses.length}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-8 sm:space-y-12"
          >
            {/* Verse Reference */}
            <div className="text-center">
              <motion.span 
                layoutId="reference"
                className="inline-block px-3 sm:px-4 py-1 sm:py-1.5 bg-stone-200 rounded-full text-[9px] sm:text-[11px] font-bold uppercase tracking-widest text-stone-600 mb-2 sm:mb-4 shadow-sm"
              >
                {currentVerse?.reference}
              </motion.span>
            </div>

            {/* English Verse */}
            <div className="text-center px-2">
              <div className="flex flex-wrap justify-center gap-x-2 sm:gap-x-3 gap-y-3 sm:gap-y-4">
                {currentVerse?.english.split(" ").map((word, i) => (
                  <motion.span
                    key={i}
                    whileHover={{ scale: 1.05, color: "#d97706" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleWordClick(word)}
                    className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-medium cursor-pointer transition-colors leading-tight select-none"
                  >
                    {word}
                  </motion.span>
                ))}
              </div>
            </div>

            {/* Pronunciation & Meaning */}
            <div className="text-center space-y-4 sm:space-y-6 px-4">
              <p className="text-stone-400 text-xs sm:text-base md:text-xl italic font-medium tracking-wide max-w-3xl mx-auto leading-relaxed">
                {currentVerse?.pronunciation}
              </p>
              <div className="w-12 sm:w-16 h-[1px] bg-stone-300 mx-auto" />
              <p className="text-lg sm:text-2xl md:text-3xl font-medium text-stone-700 leading-relaxed max-w-3xl mx-auto">
                {currentVerse?.meaning}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Controls */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-stone-200 py-6 sm:py-8 px-4 sm:px-6 z-30 pb-safe">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={prevVerse}
            className="p-3 sm:p-4 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-stone-900 active:scale-90"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-6 sm:gap-10">
            <button
              onClick={handleManualSpeak}
              disabled={isSpeaking || isLoading}
              className={`flex flex-col items-center gap-1 group transition-opacity ${isSpeaking ? 'opacity-50' : ''}`}
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-stone-900 flex items-center justify-center text-white group-hover:bg-stone-800 transition-all shadow-xl active:scale-90">
                <Volume2 className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-stone-400 mt-1.5 sm:mt-2">Listen</span>
            </button>

            <button
              onClick={toggleRepeat}
              disabled={isLoading}
              className="flex flex-col items-center gap-1 group"
            >
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 flex items-center justify-center transition-all shadow-lg active:scale-90 ${
                isRepeating 
                  ? 'bg-amber-500 border-amber-500 text-white' 
                  : 'bg-white border-stone-200 text-stone-900 hover:border-stone-900'
              }`}>
                {isRepeating ? <Pause className="w-6 h-6 sm:w-7 sm:h-7 animate-pulse" /> : <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7" />}
              </div>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-stone-400 mt-1.5 sm:mt-2">
                {isRepeating ? 'Repeating' : 'Repeat'}
              </span>
            </button>
          </div>

          <button
            onClick={nextVerse}
            className="p-3 sm:p-4 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-stone-900 active:scale-90"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </footer>

      {/* Search Modal */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/70 backdrop-blur-sm z-50 flex items-start justify-center pt-10 sm:pt-20 px-4 sm:px-6"
            onClick={() => setIsSearchOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -20 }}
              className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSearch} className="p-4 sm:p-6 space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g., Genesis 1:1, Psalm 23"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 sm:py-4 bg-stone-100 border-none rounded-xl sm:rounded-2xl text-base sm:text-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] sm:text-xs text-stone-400 font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    AI Powered Search
                  </p>
                  <button
                    type="submit"
                    disabled={isLoading || !searchQuery.trim()}
                    className="px-4 sm:px-6 py-2 bg-stone-900 text-white rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm hover:bg-stone-800 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                  </button>
                </div>
              </form>
              
              <div className="border-t border-stone-100 p-4 sm:p-6 bg-stone-50">
                <h3 className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-3 sm:mb-4">Quick Links</h3>
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2">
                  {["Genesis", "Psalms", "Proverbs", "Matthew", "John", "Romans"].map(book => (
                    <button
                      key={book}
                      onClick={() => setSearchQuery(`${book} 1:1`)}
                      className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-[10px] sm:text-xs font-medium text-stone-600 hover:border-amber-500 hover:text-amber-600 transition-all text-center"
                    >
                      {book}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-[85%] max-w-xs bg-white z-50 shadow-2xl flex flex-col"
            >
              <div className="p-4 sm:p-6 border-b border-stone-100 flex justify-between items-center">
                <h2 className="text-xs sm:text-sm uppercase tracking-widest font-bold text-stone-900">Bible Books</h2>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-stone-100 rounded-full">
                  <X className="w-5 h-5 text-stone-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-6">
                <div>
                  <h3 className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-amber-600 mb-3 px-2">Old Testament</h3>
                  <div className="grid grid-cols-1 gap-0.5">
                    {BIBLE_BOOKS.slice(0, 39).map(book => (
                      <button
                        key={book}
                        onClick={() => {
                          setSearchQuery(`${book} 1:1`);
                          setIsMenuOpen(false);
                          setIsSearchOpen(true);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm text-stone-600 hover:bg-stone-100 transition-colors active:bg-stone-200"
                      >
                        {book}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-amber-600 mb-3 px-2">New Testament</h3>
                  <div className="grid grid-cols-1 gap-0.5">
                    {BIBLE_BOOKS.slice(39).map(book => (
                      <button
                        key={book}
                        onClick={() => {
                          setSearchQuery(`${book} 1:1`);
                          setIsMenuOpen(false);
                          setIsSearchOpen(true);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm text-stone-600 hover:bg-stone-100 transition-colors active:bg-stone-200"
                      >
                        {book}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
        )}
      </AnimatePresence>

      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap');
        .font-serif { font-family: 'Cormorant Garamond', serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
        
        /* Safe area for mobile */
        .pb-safe {
          padding-bottom: calc(2rem + env(safe-area-inset-bottom));
        }
        
        /* Better touch targets */
        button {
          touch-action: manipulation;
        }
        
        /* Scrollbar styling */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e5e5e0; border-radius: 10px; }
        
        /* Prevent zoom on input on iOS */
        @media screen and (max-width: 768px) {
          input { font-size: 16px !important; }
        }
      `}} />
    </div>
  );
}
