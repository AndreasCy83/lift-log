import { useState } from 'react';
import { BarChart3, Dumbbell, Target, Trophy } from 'lucide-react';
import WorkoutsTab from '@/components/stats/WorkoutsTab';
import BreakdownTab from '@/components/stats/BreakdownTab';

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
  const [activeTab, setActiveTab] = useState<TabId>('workouts');

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto max-w-lg">
          <h1 className="font-display text-xl font-bold">Stats & Tools</h1>
        </div>
      </header>

      {/* Tab bar */}
      <div className="sticky top-[53px] z-30 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto max-w-lg flex overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4">
        {activeTab === 'workouts' && <WorkoutsTab />}
        {activeTab === 'breakdown' && <BreakdownTab />}
        {activeTab === 'exercises' && <PlaceholderTab icon={Dumbbell} message="Exercise analytics coming soon" />}
        {activeTab === 'goals' && <PlaceholderTab icon={Target} message="Goals coming soon" />}
        {activeTab === 'records' && <PlaceholderTab icon={Trophy} message="Personal records coming soon" />}
      </div>
    </div>
  );
}
