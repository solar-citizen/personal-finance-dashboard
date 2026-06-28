'use client';

import { useState } from 'react';

import ChatBubble from './ChatBubble';
import ChatWindow from './ChatWindow';

export default function ChatContainer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {!isOpen && <ChatBubble onShow={() => setIsOpen(true)} />}
      <ChatWindow isOpen={isOpen} onHide={() => setIsOpen(false)} />
    </>
  );
}
