import { useState, useMemo } from 'react';
import { BarChart3, Dumbbell, Target, Trophy, Heart, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getWorkouts } from '@/lib/storage';
import SupportModal from '@/components/SupportModal';
import WorkoutsTab from '@/components/stats/WorkoutsTab';
import BreakdownTab from '@/components/stats/BreakdownTab';
import ExercisesTab from '@/components/stats/ExercisesTab';
import GoalsTab from '@/components/stats/GoalsTab';
import RecordsTab from '@/components/stats/RecordsTab';

const TABS = [
  { id: 'workouts', label: 'Workouts' },
  { id: 'breakdown', label: 'Breakdown' },
  { id: 'exercises', label: 'Exercises' },
  { id: 'goals', label: 'Goals' },
  { id: 'records', label: 'Records' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function PlaceholderTab({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
      <Icon className="h-10 w-10" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export default function StatsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('workouts');
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const workouts = useMemo(() => getWorkouts(), []);

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Stats & Analytics</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSupportModalOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Support the creator"
            >
              <Heart className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label={t('nav.settings')}
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="sticky z-30 border-b border-border bg-background/95 backdrop-blur-lg" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 53px)' }}>
        <div className="mx-auto max-w-lg flex overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 whitespace-nowrap px-2.5 min-h-[36px] text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              style={{ fontSize: '12px', fontWeight: 500 }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4">
        {activeTab === 'workouts' && <WorkoutsTab />}
        {activeTab === 'breakdown' && <BreakdownTab />}
        {activeTab === 'exercises' && <ExercisesTab />}
        {activeTab === 'goals' && <GoalsTab />}
        {activeTab === 'records' && <RecordsTab />}
      </div>

      <SupportModal
        open={supportModalOpen}
        workoutCount={workouts.length}
        onClose={() => setSupportModalOpen(false)}
      />
    </div>
  );
}
