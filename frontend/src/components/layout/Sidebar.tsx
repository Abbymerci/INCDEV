import { NavLink } from "react-router-dom";
import Icon from "../Icon";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/incidents", label: "Incidents", icon: "emergency_home" },
  { to: "/services", label: "Services", icon: "hub" },
  { to: "/changes", label: "Changes", icon: "edit_calendar" },
  { to: "/analytics", label: "Analytics", icon: "analytics" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

export default function Sidebar() {
  return (
    <aside className="bg-surface w-[260px] h-full fixed left-0 top-0 border-r border-outline-variant flex flex-col z-50">
      <div className="p-6 border-b border-outline-variant flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-sm bg-primary-container flex items-center justify-center text-on-primary-container font-bold shrink-0"
          aria-hidden="true"
        >
          EI
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md font-bold text-primary leading-tight">
            Enterprise Incident
          </h1>
          <p className="font-caption text-caption text-on-surface-variant mt-1">Management Portal</p>
        </div>
      </div>

      <div className="p-4">
        <button
          type="button"
          className="w-full bg-primary-container text-on-primary-container py-2.5 rounded font-label-md text-label-md uppercase tracking-wider hover:bg-primary transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <Icon name="add" className="text-[18px]" />
          New Incident
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 flex flex-col gap-1 overflow-y-auto font-body-md text-body-md">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 transition-all duration-200 ease-in-out ${
                isActive
                  ? "border-l-4 border-primary bg-secondary-container/20 text-primary font-bold"
                  : "border-l-4 border-transparent text-on-surface-variant hover:bg-surface-container-high"
              }`
            }
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
