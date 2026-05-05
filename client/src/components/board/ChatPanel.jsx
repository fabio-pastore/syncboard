import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import SentMessage from "./SentMessage";
import ReceivedMessage from "./ReceivedMessage";

export default function ChatPanel({ chatOpen, setChatOpen, chatMessages, setChatMessages, unreadMessages, setUnreadMessages, socketRef, user, setIsOpenContextMenu }) {
    const [inputMessage, setInputMessage] = useState("");
    const inputMessageRef = useRef(null);
    const messagesEndRef = useRef(null);

    useEffect(() => { inputMessageRef.current = inputMessage }, [inputMessage]);
    useEffect(() => { scrollToBottom(); }, [chatMessages]);

    const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behaviour: "smooth" }); };

    const sendMessage = () => {
        if (!inputMessageRef.current) return;
        const curr_time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const msg_payload = { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, username: user ? user.username : 'guest', time: curr_time, body: inputMessageRef.current };
        socketRef.current?.emit('chat:send', msg_payload);
        setChatMessages((prev) => [...prev, { type: "own", id: msg_payload.id, username: user ? user.username : 'guest', time: curr_time, body: inputMessageRef.current }]);
        setInputMessage("");
    };

    return (
        <>
            {/* chat toggle button */}
            <div className="fixed bottom-20 md:bottom-2 right-2 flex items-center gap-2 pointer-events-auto z-10 transition-all duration-300">
                <button
                    onClick={() => { setChatOpen((prev) => !prev); setIsOpenContextMenu(false); setUnreadMessages(0); }}
                    className="py-2 px-3 rounded-xl bg-white border border-gray-200 text-gray-600 shadow-sm transition cursor-pointer hover:bg-gray-50 hover:text-gray-900"
                >
                    <MessageCircle size={18} />

                    {!chatOpen && unreadMessages > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white shadow-sm">
                            {unreadMessages > 99 ? '99+' : unreadMessages}
                        </div>
                    )}
                </button>
            </div>

            {/* chat panel */}
            <div
                className={`
                    fixed bottom-20 md:bottom-2 right-2 z-20 flex flex-col w-80 md:w-96 
                    h-[70vh] md:h-[74vh] 2xl:h-[84vh] 
                    bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden font-sans
                    transition-all duration-300 ease-in-out origin-bottom-right 
                    ${chatOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}                                                                                                               
                `}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
                    <h3 className="text-base font-semibold text-gray-800">Board chat</h3>
                    <button className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors focus:outline-none">
                        <X
                            className="h-5 w-5"
                            onClick={() => setChatOpen((prev) => !prev)}
                        />
                    </button>
                </div>

                <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4 min-w-0 break-words overflow-x-hidden">

                    <div className="mx-auto max-w-[90%] bg-gray-200 text-gray-600 font-semibold text-xs text-center px-4 py-2.5 rounded-xl mb-4">
                        Welcome to this board's chat room!<br />
                        <span className="text-xs text-[11px] font-normal">Please be kind to other users.</span>
                    </div>

                    {
                        chatMessages.map((msg) => {
                            if (msg.type === 'own') {
                                return (
                                    <div key={msg.id} className="animate-message flex flex-col w-fit max-w-[85%] min-w-0 break-words ml-auto space-y-1">
                                        <SentMessage
                                            username={"you"}
                                            time={msg.time}
                                            body={msg.body}
                                        />
                                    </div>
                                );
                            }
                            else return (
                                <div key={msg.id} className="animate-message flex flex-col w-fit max-w-[85%] min-w-0 break-words space-y-1">
                                    <ReceivedMessage
                                        username={msg.username}
                                        time={msg.time}
                                        body={msg.body}
                                    />
                                </div>
                            );
                        })
                    }

                    <div ref={messagesEndRef} />

                </div>

                <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
                    <input
                        type="text"
                        value={inputMessage}
                        placeholder="Type a message..."
                        className="flex-1 bg-gray-100 text-gray-800 placeholder-gray-400 text-sm px-4 py-2.5 rounded-full border border-transparent focus:bg-white focus:border-purple-300 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyUp={(e) => { if (!(e.key === 'Enter')) return; sendMessage(); }}
                    />

                    <button
                        className="p-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-1 flex-shrink-0 flex items-center justify-center"
                        onClick={sendMessage}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </>
    );
}