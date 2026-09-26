import React, { useEffect, useRef } from "react";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { Slide, toast, ToastContainer } from "react-toastify";
import { Menu } from "./components/layout/Menu";
import { TitleBar } from "./components/layout/TitleBar";
import { useSettings } from "./context/SettingsProvider";
import { Changelog } from "./pages/Changelog";
import { Downloads } from "./pages/Downloads";
import { Home } from "./pages/Home";
import { Query } from "./pages/Query";
import { SettingsPage } from "./pages/Settings";
import { Status } from "./pages/Status";

const Content = () => {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    main.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <main
      ref={main}
      className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden rounded-tl-2xl border-l border-t border-line bg-panel"
    >
      <div className="mx-auto w-full max-w-[1040px] px-8 pb-12 pt-7">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Query />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/status" element={<Status />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/changelog" element={<Changelog />} />
        </Routes>
      </div>
    </main>
  );
};

const App = () => {
  const { settings } = useSettings();

  useEffect(
    () =>
      window.electron.onNotice(({ type, message }) => {
        if (type === "error") toast.error(message);
        else if (type === "success") toast.success(message);
        else toast.info(message);
      }),
    [],
  );

  return (
    <HashRouter>
      <div className="flex h-full flex-col">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <Menu />
          {settings && <Content />}
        </div>
      </div>
      <ToastContainer
        position="bottom-right"
        autoClose={3500}
        transition={Slide}
        hideProgressBar
        theme={settings?.theme === "light" ? "light" : "dark"}
        newestOnTop
      />
    </HashRouter>
  );
};

export default App;
