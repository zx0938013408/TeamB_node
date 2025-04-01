import { wsClients } from '../index.js';

export const wsRooms = new Map();

export function notifyUser(memberId, message) {
  const ws = wsClients.get(memberId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'new-message', data: message }));
    console.log(`📨 已推播給用戶 ${memberId}`);
  } else {
    console.log(`⚠️ 無法推播，WebSocket 不存在或尚未連線`);
  }
}

export function joinRoom(ws, roomName) {
  if (!wsRooms.has(roomName)) {
    wsRooms.set(roomName, new Set());
  }
  wsRooms.get(roomName).add(ws);
  ws.roomName = roomName;
  console.log(`👥 加入房間 ${roomName}`);
}

export function broadcastToActivity(activityId, messageData) {
  const room = wsRooms.get(`activity-${activityId}`);
  if (!room) return;

  const payload = {
    type: 'new-comment',
    activity_id: activityId,
    data: messageData,
  };

  for (const ws of room) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }
  console.log(`📣 廣播留言給房間 activity-${activityId}`);
}