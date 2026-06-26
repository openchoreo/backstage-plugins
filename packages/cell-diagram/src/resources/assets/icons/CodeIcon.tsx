import { CSSProperties } from 'react';

export function CodeIcon(props: { styles?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{ ...props.styles }}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="m7 8l-4 4l4 4m10-8l4 4l-4 4M14 4l-4 16"
      />
    </svg>
  );
}
