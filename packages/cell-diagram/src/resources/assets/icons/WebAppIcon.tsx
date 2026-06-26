import { CSSProperties } from "react";

export function WebAppIcon(props: { styles?: CSSProperties }) {
    return (
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{ ...props.styles }}>
            <g fill="none">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M42 18v22a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V18" />
                <path stroke="currentColor" strokeLinejoin="round" strokeWidth="4" d="M6 8a2 2 0 0 1 2-2h32a2 2 0 0 1 2 2v10H6V8Z" />
                <path
                    fill="currentColor"
                    fillRule="evenodd"
                    d="M12 14a2 2 0 1 0 0-4a2 2 0 0 0 0 4Zm6 0a2 2 0 1 0 0-4a2 2 0 0 0 0 4Zm6 0a2 2 0 1 0 0-4a2 2 0 0 0 0 4Z"
                    clipRule="evenodd"
                />
            </g>
        </svg>
    );
}
