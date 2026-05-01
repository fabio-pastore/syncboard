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