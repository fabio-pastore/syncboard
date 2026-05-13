/**
 * Displays a chat message sent by the current user.
 *
 * Renders "You" as the sender, a timestamp, and the message body in a styled
 * bubble aligned to the right of the chat panel.
 *
 * @param {object} props - Component props.
 * @param {string} props.time - The formatted time the message was sent.
 * @param {string} props.body - The text content of the message.
 * @returns {JSX.Element} The sent message UI element.
 */

export default function SentMessage({time, body}) {
    return (
    <div className="flex flex-col w-full min-w-0 space-y-1">
        <div className="flex items-baseline justify-between space-x-2 px-1 w-full">
            <span className="text-xs font-medium text-purple-600">You</span>
            <span className="text-xs text-gray-400">{time}</span>
        </div>

        <div className="bg-purple-100 border border-purple-200 p-3 rounded-2xl rounded-tr-sm text-sm text-purple-900 shadow-sm w-fit max-w-full break-words whitespace-pre-wrap">
            {body}
        </div>
    </div>
    )
}