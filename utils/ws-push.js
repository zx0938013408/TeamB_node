import { wsClients } from '../index.js';

export function notifyUser(memberId, message) {
  const ws = wsClients.get(memberId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'new-message', data: message }));
    console.log(`📨 已推播給用戶 ${memberId}`);
  } else {
    console.log(`⚠️ 無法推播，WebSocket 不存在或尚未連線`);
  }
}
