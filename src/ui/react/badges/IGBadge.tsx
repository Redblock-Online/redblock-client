
export default function IGBadge() {
  return (
    <div className="ig-badge">
      <a href="https://instagram.com/redblock.online" target="_blank" rel="noopener noreferrer">
        <svg
          width="230"
          height="48"
          viewBox="0 0 230 48"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Instagram: @redblock.online"
        >
          <rect className="badge" x="1.5" y="1.5" rx="8" ry="8" width="227" height="45" />
          <g transform="translate(12,10)">
            <rect className="icon" x="0" y="0" width="28" height="28" rx="6" ry="6" />
            <circle className="icon" cx="14" cy="14" r="7.5" />
            <circle className="dot" cx="22.2" cy="5.8" r="2.2" />
          </g>
          <text className="label" x="52" y="31">
            @redblock.online
          </text>
        </svg>
      </a>
    </div>
  );
}

