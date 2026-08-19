import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

export default function AppLayout() {
  return (
    <div className="bg-background text-on-background min-h-screen font-body-md text-body-md">
      <Sidebar />
      <div className="ml-[260px] flex flex-col min-h-screen">
        <TopNav />
        <main className="flex-1 bg-background">
          <div className="max-w-container-max-width mx-auto px-margin-desktop py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
