/**
 * Displays a user entry with a profile picture or initial avatar and username.
 *
 * Used in the connected users list and other places where a user identity
 * needs to be displayed concisely.
 *
 * @param {object} props - Component props.
 * @param {string} props.username - The display name of the user.
 * @param {string|null} [props.profilePicture] - The URL of the user's profile image. If null, a placeholder with the first letter of the username is shown.
 * @returns {JSX.Element} The user entry component.
 */

export default function UserEntry({username, profilePicture}) {
    return (
        <div className='flex items-center justify-left gap-2 px-2'>
            {profilePicture ? (
                <img src={profilePicture} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-300" />
            ) : (
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                    <span className="text-sm font-semibold text-violet-600">{username?.[0]?.toUpperCase() || '?'}</span>
                </div>
            )} {username}
        </div>
    )
}