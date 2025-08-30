
export default function IGBadge() {
  return (
    <div className="fixed top-3 right-3 z-20">
      <a href="https://instagram.com/redblock.online" target="_blank" rel="noopener noreferrer">
        <svg
          width="230"
          height="48"
          viewBox="0 0 230 48"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Instagram: @redblock.online"
        >
          <rect x="1.5" y="1.5" rx="8" ry="8" width="227" height="45" fill="#fff" stroke="#000" strokeWidth="3" />
          <g transform="translate(12,10)" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="0" y="0" width="28" height="28" rx="6" ry="6" />
            <circle cx="14" cy="14" r="7.5" />
            <circle cx="22.2" cy="5.8" r="2.2" fill="#000" stroke="none" />
          </g>
          <text x="52" y="31" style={{ font: '700 18px/1 "Courier New", ui-monospace, monospace', fill: '#000' }}>
            @redblock.online
          </text>
        </svg>
      </a>
    </div>
  );
}
