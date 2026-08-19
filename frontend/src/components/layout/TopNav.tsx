import Icon from "../Icon";

export default function TopNav() {
  return (
    <nav className="bg-surface h-16 sticky top-0 z-40 border-b border-outline-variant shadow-sm flex justify-between items-center px-margin-desktop ml-[260px] w-[calc(100%-260px)]">
      <div className="flex items-center gap-4">
        <span className="font-title-lg text-title-lg font-semibold text-primary">Incident Console</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            className="pl-10 pr-4 py-1.5 border border-outline-variant rounded bg-surface-container-low text-body-md focus:border-secondary focus:ring-secondary outline-none w-64 transition-all"
            placeholder="Search incidents..."
            type="text"
          />
        </div>
        <button type="button" className="text-on-surface-variant hover:text-primary transition-colors p-2" aria-label="Notifications">
          <Icon name="notifications" />
        </button>
        <button type="button" className="text-on-surface-variant hover:text-primary transition-colors p-2" aria-label="Help">
          <Icon name="help_outline" />
        </button>
        <button type="button" className="text-on-surface-variant hover:text-primary transition-colors p-2" aria-label="Account">
          <Icon name="account_circle" />
        </button>
      </div>
    </nav>
  );
}
