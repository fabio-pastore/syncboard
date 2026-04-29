import { User } from "lucide-react";

export default function UserEntry({username}) {
    return (
        <div className='px-2'>
            <User className='inline' size={16} /> {username}
        </div>
    )
}