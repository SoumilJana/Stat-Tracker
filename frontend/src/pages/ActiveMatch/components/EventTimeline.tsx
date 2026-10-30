import { Clock, Activity, SkipForward, Undo2 } from 'lucide-react';

interface EventTimelineProps {
  events: any[];
  session: any;
  profile: any;
  teamA: any;
  teamB: any;
  onPitch: any[];
  waiting: any[];
  onUndoEvent: (eventId: string) => void;
}

export function EventTimeline({
  events,
  session,
  profile,
  teamA,
  teamB,
  onPitch,
  waiting,
  onUndoEvent
}: EventTimelineProps) {
  return (
    <div className="bg-black border border-white/5 rounded-3xl flex flex-col h-[400px] lg:h-[600px] shadow-xl overflow-hidden">
      <div className="p-6 border-b border-white/5 flex items-center gap-3">
        <Clock className="w-5 h-5 text-neutral-400" />
        <h3 className="font-bold text-white tracking-widest uppercase">Match Events</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 space-y-2">
            <Activity className="w-8 h-8 opacity-20" />
            <p className="text-sm font-medium tracking-wide">No events recorded yet.</p>
          </div>
        ) : (
          events.map((event, idx) => (
            <div key={event.id} className="flex items-start justify-between group p-3 hover:bg-white/5 rounded-2xl transition-colors">
              <div className="flex gap-3">
                <div className="mt-1">
                  {event.event_type === 'GOAL' && (
                    <div
                      className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)] ${
                        event.team_id === teamA?.id
                          ? 'bg-primary-500 shadow-primary-500/50'
                          : event.team_id === teamB?.id
                          ? 'bg-blue-500 shadow-blue-500/50'
                          : 'bg-white'
                      }`}
                    />
                  )}
                  {event.event_type === 'NO_GOAL_TIME_UP' && <SkipForward className="w-3 h-3 text-neutral-500" />}
                </div>
                <div>
                  <p className="text-sm text-white">
                    {event.event_type === 'GOAL' ? (
                      <>
                        <span className="font-bold">{event.player?.username || event.profiles?.username}</span> scored for{' '}
                        <span className="font-medium text-neutral-400">
                          {Object.values(onPitch).concat(waiting).find(t => t.id === event.team_id)?.name}
                        </span>
                        {event.assister?.username && <span className="text-neutral-500 ml-1">(Ast: {event.assister.username})</span>}
                      </>
                    ) : event.event_type === 'NO_GOAL_TIME_UP' ? (
                      <span className="italic text-neutral-400">Time up / No goals (Teams rotated)</span>
                    ) : (
                      <span className="italic text-neutral-400">Match ended</span>
                    )}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
              </div>
              {idx === 0 && session.status === 'IN_PROGRESS' && profile?.role === 'admin' && (
                <button
                  onClick={() => onUndoEvent(event.id)}
                  className="text-neutral-500 hover:text-red-400 p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  title="Undo Event"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
