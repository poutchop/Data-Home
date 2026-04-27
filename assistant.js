/**
 * Vault AI Assistant
 * Provides interactive onboarding and support for Carbon Clarity Data Vault
 */

const VAULT_KNOWLEDGE = {
  "dmrv": "dMRV stands for digital Monitoring, Reporting, and Verification. It's our way of using technology to prove that climate actions (like avoiding firewood) actually happened, so we can issue trusted carbon credits.",
  "scan": "To scan a board, go to the 'Scanner' tab. You'll need to lock your GPS, select the participant's week, take a photo of the stickers, and finally scan the QR code on the physical board.",
  "payout": "Payouts are sent weekly to your mobile money (MTN or Telecel) once your scans are 'hardened'. Hardening happens automatically when our system verifies your GPS location and QR signature match.",
  "gps": "GPS verification ensures that the scan was performed at the correct site. For the Berekuso pilot, you must be within 50 meters of the participant's farm centroid for a successful scan.",
  "photo": "We require a photo of the board as physical evidence. This helps auditors confirm that the stickers match the digital record, providing a 'Physical Evidence Bridge'.",
  "ashesi": "This project is a pilot in Berekuso, in partnership with Ashesi University, to empower local farmers with climate-smart technology.",
  "hello": "Hello! I'm the Vault AI. I can help you understand how to use the app, track your impact, or troubleshoot scanning issues.",
  "help": "You can ask me about: 'how to scan', 'when are payouts', 'what is dMRV', or 'GPS accuracy'."
};

function toggleAIChat() {
  const chat = document.getElementById('ai-chat');
  chat.classList.toggle('active');
  if (chat.classList.contains('active')) {
    document.getElementById('ai-input').focus();
  }
}

function handleAISuggest(text) {
  document.getElementById('ai-input').value = text;
  sendAIMessage();
}

function sendAIMessage() {
  const input = document.getElementById('ai-input');
  const text = input.value.trim();
  if (!text) return;

  // Add user message
  addMessage(text, 'user');
  input.value = '';

  // Simulate "typing"
  setTimeout(() => {
    const response = getAIResponse(text);
    addMessage(response, 'bot');
  }, 600);
}

function addMessage(text, sender) {
  const body = document.getElementById('ai-body');
  const msg = document.createElement('div');
  msg.className = `ai-msg ${sender}`;
  msg.innerHTML = text;
  body.appendChild(msg);
  body.scrollTop = body.scrollHeight;
}

function getAIResponse(text) {
  const lower = text.toLowerCase();
  
  if (lower.includes('dmrv')) return VAULT_KNOWLEDGE.dmrv;
  if (lower.includes('scan') || lower.includes('how to')) return VAULT_KNOWLEDGE.scan;
  if (lower.includes('pay') || lower.includes('money')) return VAULT_KNOWLEDGE.payout;
  if (lower.includes('gps') || lower.includes('location')) return VAULT_KNOWLEDGE.gps;
  if (lower.includes('photo') || lower.includes('evidence')) return VAULT_KNOWLEDGE.photo;
  if (lower.includes('ashesi')) return VAULT_KNOWLEDGE.ashesi;
  if (lower.includes('hello') || lower.includes('hi')) return VAULT_KNOWLEDGE.hello;
  
  return "I'm not sure about that. Try asking about 'scanning', 'payouts', or 'dMRV'. I'm still learning!";
}

// Initial Greeting after a delay
setTimeout(() => {
  const fab = document.getElementById('ai-fab');
  if (fab) {
    // Subtle bounce effect or badge could go here
  }
}, 2000);
