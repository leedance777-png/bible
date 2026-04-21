const chatEl = document.getElementById('chat');
const formEl = document.getElementById('chatForm');
const inputEl = document.getElementById('userInput');

let bibleData = [];

const FALLBACK_MESSAGE = '조금 더 구체적으로 질문해 주세요 🙏';

const scrollToBottom = () => {
  chatEl.scrollTop = chatEl.scrollHeight;
};

const createMessage = (text, role = 'bot') => {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  row.appendChild(bubble);
  chatEl.appendChild(row);
  scrollToBottom();

  return bubble;
};

const createLoadingMessage = () => {
  const row = document.createElement('div');
  row.className = 'message-row bot';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const dots = document.createElement('div');
  dots.className = 'loading-dots';
  dots.innerHTML = '<span></span><span></span><span></span>';

  bubble.appendChild(dots);
  row.appendChild(bubble);
  chatEl.appendChild(row);
  scrollToBottom();

  return row;
};

const typeText = (element, text, speed = 20) =>
  new Promise((resolve) => {
    element.textContent = '';
    let index = 0;

    const timer = setInterval(() => {
      element.textContent += text[index] || '';
      index += 1;
      scrollToBottom();

      if (index >= text.length) {
        clearInterval(timer);
        resolve();
      }
    }, speed);
  });

// 간단한 키워드 추출 규칙
const extractKeyword = (inputText) => {
  if (inputText.includes('사랑')) return '사랑';
  if (inputText.includes('믿음')) return '믿음';
  if (inputText.includes('용서')) return '용서';
  return null;
};

const formatResponse = (entry) => `📖 ${entry.verse}\n\n👉 해석:\n${entry.explanation}\n\n💡 쉽게 말하면:\n${entry.simple}`;

const getBotResponse = (userText) => {
  const keyword = extractKeyword(userText);
  if (!keyword) return FALLBACK_MESSAGE;

  const matched = bibleData.find((item) => item.keyword === keyword);
  if (!matched) return FALLBACK_MESSAGE;

  return formatResponse(matched);
};

const handleSend = async () => {
  const text = inputEl.value.trim();
  if (!text) return;

  createMessage(text, 'user');
  inputEl.value = '';

  const loadingRow = createLoadingMessage();
  const responseText = getBotResponse(text);

  const delay = 1000 + Math.floor(Math.random() * 501);
  await new Promise((resolve) => setTimeout(resolve, delay));

  loadingRow.remove();
  const botBubble = createMessage('', 'bot');
  await typeText(botBubble, responseText, 20);
};

const init = async () => {
  try {
    const response = await fetch('data.json');
    bibleData = await response.json();

    createMessage('안녕하세요! Bible AI입니다. 사랑, 믿음, 용서에 대해 질문해 보세요 🙌', 'bot');
  } catch (error) {
    createMessage('데이터를 불러오지 못했어요. 파일 경로를 확인해 주세요.', 'bot');
    console.error(error);
  }
};

formEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  await handleSend();
});

// Enter 키 전송은 form submit으로 처리
inputEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    formEl.requestSubmit();
  }
});

init();
