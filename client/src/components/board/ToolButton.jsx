export default function ToolButton({ children, active, onClick, title, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`p-2 rounded-xl transition cursor-pointer 
                ${active ? "bg-violet-100 text-violet-700 cursor-pointer" : ""}
                ${disabled ? "opacity-30 cursor-not-allowed" : ""}
            `}
        >
            {children}
        </button>
    );
}
