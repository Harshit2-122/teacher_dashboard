import { useState } from 'react';
import TeacherHeader, { type Tab } from './components/TeacherHeader';
import TeacherStreamView from './views/TeacherStreamView';
import TeacherSummaryView from './views/TeacherSummaryView';
import { ThemeProvider } from './context/ThemeContext';

function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>('stream');

  return (
    <div className="flex flex-col min-h-svh bg-[var(--bg)] text-[var(--text)] transition-colors duration-200">
      <TeacherHeader activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 flex flex-col">
        {/* Stream tab */}
        <div role="tabpanel" aria-label="Stream" hidden={activeTab !== 'stream'} className="flex-1 flex flex-col">
          {activeTab === 'stream' && <TeacherStreamView />}
        </div>

        {/* Summary tab */}
        <div role="tabpanel" aria-label="Summary" hidden={activeTab !== 'summary'}>
          <TeacherSummaryView active={activeTab === 'summary'} />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
