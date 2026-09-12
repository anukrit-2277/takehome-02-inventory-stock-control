/**
 * Inline icons, drawn on a 24x24 grid with a 1.75 stroke so they sit evenly
 * beside 13–14px text. Kept local rather than pulling in an icon package for
 * the dozen shapes this app actually uses.
 */
function Svg({ children, className = 'h-4 w-4', ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Svg>
);
export const IconPackage = (p) => (
  <Svg {...p}><path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z" /><path d="m3 7.5 9 4.5 9-4.5" /><path d="M12 12v9" /><path d="M7.5 5.25 16.5 9.75" /></Svg>
);
export const IconMovements = (p) => (
  <Svg {...p}><path d="M7 4 3 8l4 4" /><path d="M3 8h13a4 4 0 0 1 0 8h-1" /><path d="m17 20 4-4-4-4" /></Svg>
);
export const IconAlert = (p) => (
  <Svg {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></Svg>
);
export const IconTransfer = (p) => (
  <Svg {...p}><path d="M12 3v18" /><path d="m8 7 4-4 4 4" /><path d="M3 12h18" /></Svg>
);
export const IconSettings = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></Svg>
);
export const IconSearch = (p) => (<Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></Svg>);
export const IconPlus = (p) => (<Svg {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>);
export const IconDownload = (p) => (<Svg {...p}><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" /></Svg>);
export const IconUpload = (p) => (<Svg {...p}><path d="M12 20V8" /><path d="m7 12 5-5 5 5" /><path d="M4 4h16" /></Svg>);
export const IconClose = (p) => (<Svg {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>);
export const IconChevronLeft = (p) => (<Svg {...p}><path d="m15 5-7 7 7 7" /></Svg>);
export const IconChevronRight = (p) => (<Svg {...p}><path d="m9 5 7 7-7 7" /></Svg>);
export const IconLogout = (p) => (<Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Svg>);
export const IconCheck = (p) => (<Svg {...p}><path d="m4 12 5.5 5.5L20 7" /></Svg>);
export const IconClock = (p) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></Svg>);
export const IconActivity = (p) => (<Svg {...p}><path d="M3 12h4l3 8 4-16 3 8h4" /></Svg>);
export const IconArrowUp = (p) => (<Svg {...p}><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></Svg>);
export const IconArrowDown = (p) => (<Svg {...p}><path d="M12 5v14" /><path d="m5 12 7 7 7-7" /></Svg>);
export const IconArchive = (p) => (<Svg {...p}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></Svg>);
export const IconEdit = (p) => (<Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>);
export const IconNote = (p) => (<Svg {...p}><path d="M4 4h16v12l-4 4H4Z" /><path d="M16 20v-4h4" /><path d="M8 9h8" /><path d="M8 13h4" /></Svg>);
export const IconMenu = (p) => (<Svg {...p}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></Svg>);
