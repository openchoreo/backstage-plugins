import { CSSProperties } from "react";

export function LayersIcon(props: { styles?: CSSProperties }) {
    return (
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ ...props.styles }}>
            <g fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2">
                <path d="m4 8l8-4l8 4l-8 4l-8-4z" />
                <path strokeLinecap="round" d="m4 12l8 4l8-4M4 16l8 4l8-4" />
            </g>
        </svg>
    );
}
