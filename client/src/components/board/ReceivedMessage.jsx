/**
 * Displays a chat message received from another user.
 *
 * Renders the sender's username, message timestamp, and body text in a styled
 * bubble aligned to the left of the chat panel.
 *
 * @param {object} props - Component props.
 * @param {string} props.username - The display name of the sender.
 * @param {string} props.time - The formatted time the message was sent.
 * @param {string} props.body - The text content of the message.
 * @returns {JSX.Element} The received message UI element.
 */

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