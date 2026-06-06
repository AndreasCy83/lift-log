import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Dumbbell, BarChart3, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAnyActiveSession } from '@/hooks/useWorkoutSession';

const tabs = [
  { to: '/', icon: Calendar, key: 'home' as const },
  { to: '/routines', icon: Dumbbell, key: 'routines' as const },
  { to: '/body', icon: Scale, key: 'body' as const },
  { to: '/stats', icon: BarChart3, key: 'stats' as const },
];

/** Custom event used by WorkoutLogPage to intercept nav while a session is live. */
export const REQUEST_LEAVE_WORKOUT_EVENT = 'request-leave-workout';

export default function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const session = useAnyActiveSession();
  const onWorkoutPage = location.pathname.startsWith('/workout/');
  const guarded = onWorkoutPage && (session?.status === 'running' || session?.status === 'paused');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 1.5rem)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 1.5rem)',
      }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around py-2 px-4">
        {tabs.map(({ to, icon: Icon, key }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              onClick={(e) => {
                if (guarded) {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent(REQUEST_LEAVE_WORKOUT_EVENT, { detail: { target: to } }));
                  return;
                }
                if (location.pathname !== to) {
                  // default NavLink behavior is fine
                }
              }}
              className="flex flex-col items-center gap-0.5 px-3 py-1 transition-colors"
            >
              <Icon
                className={`h-5 w-5 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {t(`nav.${key}`)}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
