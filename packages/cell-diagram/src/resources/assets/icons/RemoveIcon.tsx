import { CSSProperties } from 'react';

export function RemoveIcon(props: { styles?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{ ...props.styles }}
    >
      <path fill="currentColor" d="M19 12.998H5v-2h14z" />
    </svg>
  );
}
