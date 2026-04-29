export default function ReceivedMessage({username, time, body}) {
    return (
        <div className="flex flex-col w-full min-w-0 space-y-1">

            <div className="flex items-baseline justify-between px-1 w-full space-x-2">
                <span className="text-xs font-medium text-gray-600">{username}</span>
                <span className="text-xs text-gray-400">{time}</span>
            </div>

            <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-sm text-sm text-gray-700 shadow-sm w-fit max-w-full break-words whitespace-pre-wrap">
                {body}
            </div>
        </div>
    )
}