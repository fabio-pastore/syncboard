/**
 * A generic toolbar button component.
 *
 * Renders a button with active and disabled state styling. Used for tool
 * selection and action triggers in the Toolbar.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - The icon or content to display inside the button.
 * @param {boolean} [props.active=false] - Whether the button is in an active state.
 * @param {function} props.onClick - The click handler for the button.
 * @param {string} [props.title] - The tooltip title attribute.
 * @param {boolean} [props.disabled=false] - Whether the button is disabled.
 * @returns {JSX.Element} The button element.
 */

export default function ToolButton({ children, active, onClick, title, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`p-2 rounded-xl transition cursor-pointer shrink-0
                ${active ? "bg-violet-100 text-violet-700 cursor-pointer" : ""}
                ${disabled ? "opacity-30 cursor-not-allowed" : ""}
            `}
        >
            {children}
        </button>
    );
}
