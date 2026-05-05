import { ArrowLeft, Users, Share2 } from "lucide-react";
import UserEntry from "./UserEntry";

export default function HeaderBar({ board, role, shared, peers, peerEntries, user, showPeers, setShowPeers, onExit, onShare, setIsOpenContextMenu }) {
    return (
        <header className="fixed top-2 left-2 right-2 flex items-center z-10 pointer-events-none">
            
            <div className="flex items-center gap-2 pointer-events-auto shrink-0">
                <button onClick={onExit} className="w-[34px] h-[34px] flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-600 shadow-sm transition cursor-pointer hover:bg-gray-50 hover:text-gray-900">
                    <ArrowLeft size={14} />
                </button>
                
                <div className="h-[34px] flex items-center px-3 rounded-xl bg-white border border-gray-200 text-sm text-gray-900 font-medium shadow-sm max-w-[120px] md:max-w-xs truncate">
                    {board?.name || "Board name"}
                </div>
                
                {role === 'viewer' && (
                    <span className="hidden sm:flex items-center h-[34px] px-2 rounded-lg bg-white border border-gray-200 text-xs text-gray-500 shadow-sm">
                        View Only
                    </span>
                )}
            </div>

            <div className="flex-1 flex justify-center pointer-events-none min-w-0">
                <div className="text-lg md:text-2xl font-semibold truncate px-2">
                    <span className="text-violet-700/45">Sync</span>
                    <span className="text-black/45">Board</span>
                </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto shrink-0">
                <div className="relative flex flex-col items-end">
                    <button
                        className="flex items-center justify-center gap-1.5 px-3 h-[34px] rounded-xl bg-white border border-gray-200 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 shadow-sm transition cursor-pointer focus:outline-none"
                        onClick={() => { setShowPeers((prev) => !prev); setIsOpenContextMenu(false); }}
                    >
                        <Users size={14} />
                        <span>{peers}</span>
                    </button>

                    <div
                        className={`
                            absolute top-full right-0 mt-2 p-2 min-w-[180px]
                            bg-white border border-gray-100 rounded-xl shadow-lg
                            flex flex-col gap-1 text-sm text-gray-700 max-h-64
                            transition-all duration-200 origin-top-right z-10 overflow-y-auto
                            overscroll-contain
                            ${showPeers
                                ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                                : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                            }
                        `}
                    >
                        <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                            Connected users
                        </div>

                        {peerEntries.map((peer) => (
                            <div
                                key={peer.username + `${Date.now()}_${Math.random().toString(36).slice(2)}`}
                                className="px-0 py-0.5 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <UserEntry
                                    username={(peer.username === user.username) ? peer.username + " (You)" : peer.username}
                                    profilePicture={peer.pfp}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {!shared && (
                    <button onClick={() => { onShare(); setIsOpenContextMenu(false); }}
                        className="flex items-center justify-center gap-1.5 h-[34px] px-2 sm:px-3 rounded-xl bg-white border border-gray-200 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 shadow-sm transition cursor-pointer"
                    >
                        <Share2 size={14} />
                        {/* for very small screens hide "share" and just display the div with icon */}
                        <span className="hidden sm:inline-block">Share</span>
                    </button>
                )}
            </div>
        </header>
    );
}