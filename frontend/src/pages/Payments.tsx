import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, PlusCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import {
  fetchLatestGame,
  fetchGameRegistrations,
  fetchGamePayments,
  fetchPaymentProfiles,
  registerForGame,
  submitGamePayment,
  adminVerifyPayment,
  adminQuickVerifyPlayer,
  adminConfirmRoster,
  adminSettleRefund,
  createOrUpdateGame,
  buildPlayerRoster
} from '../lib/gamePaymentsApi';
import { DEFAULT_PAYMENT_PROFILES } from '../lib/upiUtils';
import { GameHeader } from './Payments/components/GameHeader';
import { ThresholdProgressBar } from './Payments/components/ThresholdProgressBar';
import { RegistrationDock } from './Payments/components/RegistrationDock';
import { PaymentSection } from './Payments/components/PaymentSection';
import { PlayerRosterList } from './Payments/components/PlayerRosterList';
import { WhatsAppSummaryModal } from './Payments/components/WhatsAppSummaryModal';
import { AdminReconciliationModal } from './Payments/components/AdminReconciliationModal';
import { CreateGameModal } from './Payments/components/CreateGameModal';
import { AdminAddPlayerModal } from './Payments/components/AdminAddPlayerModal';
import type {
  Game,
  GameRegistration,
  GamePayment,
  PaymentProfile,
  RegistrationResponse,
  PaymentMethod
} from '../types/gamePayment';

export default function Payments() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin';

  const [game, setGame] = useState<Game | null>(null);
  const [registrations, setRegistrations] = useState<GameRegistration[]>([]);
  const [payments, setPayments] = useState<GamePayment[]>([]);
  const [paymentProfiles, setPaymentProfiles] = useState<PaymentProfile[]>(DEFAULT_PAYMENT_PROFILES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Modals state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [showCreateGameModal, setShowCreateGameModal] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);

  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Load all initial game & payment data
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const latestGame = await fetchLatestGame();
      setGame(latestGame);

      if (latestGame) {
        const [regData, payData, profilesData] = await Promise.all([
          fetchGameRegistrations(latestGame.id),
          fetchGamePayments(latestGame.id),
          fetchPaymentProfiles().catch(() => DEFAULT_PAYMENT_PROFILES)
        ]);

        setRegistrations(regData);
        setPayments(payData);
        if (profilesData && profilesData.length > 0) {
          setPaymentProfiles(profilesData);
        }
      }
    } catch (err: any) {
      console.error('Failed to load payments data:', err);
      toastRef.current.error('Failed to load match & payment data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Supabase Realtime live synchronization
  useEffect(() => {
    if (!game?.id) return;

    const channel = supabase
      .channel(`payments_game_${game.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_registrations', filter: `game_id=eq.${game.id}` },
        () => {
          fetchGameRegistrations(game.id).then(setRegistrations).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_payments', filter: `game_id=eq.${game.id}` },
        () => {
          fetchGamePayments(game.id).then(setPayments).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${game.id}` },
        (payload) => {
          if (payload.new) setGame(payload.new as Game);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id]);

  // Build ordered roster
  const { activeSquad, waitingList, outList } = useMemo(() => {
    return buildPlayerRoster(registrations, payments, game?.squad_capacity);
  }, [registrations, payments, game?.squad_capacity]);

  // Current user states
  const currentRegistration = registrations.find((r) => r.user_id === user?.id);
  const currentPayment = payments.find((p) => p.user_id === user?.id);
  const isUserInSquad = activeSquad.some((p) => p.user_id === user?.id);
  const isUserWaitlisted = waitingList.some((p) => p.user_id === user?.id);
  const isPaymentUnlocked = (game?.payment_opened_at !== null && game?.payment_opened_at !== undefined) || activeSquad.length >= 10;
  const isRegistrationClosed = game?.status === 'ROSTER_CONFIRMED' || game?.status === 'REGISTRATION_CLOSED' || game?.status === 'COMPLETED' || game?.status === 'CANCELLED';

  // Handle player registration response
  const handleSelectResponse = async (response: RegistrationResponse) => {
    if (!game) return;
    try {
      setSubmittingAction(true);
      await registerForGame(game.id, response);
      toast.success(response === 'IN' ? "You're marked IN for the match!" : "You're marked OUT.");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update attendance response.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle submitting player payment claim
  const handleSubmitPayment = async (
    method: PaymentMethod,
    recipientProfileId?: string,
    utr?: string
  ) => {
    if (!game) return;
    try {
      setSubmittingAction(true);
      await submitGamePayment(game.id, method, recipientProfileId, utr);
      toast.success(
        method === 'UPI'
          ? 'UPI payment claim submitted! Awaiting admin verification.'
          : method === 'CASH'
          ? 'Cash request recorded. Please hand over cash to admin.'
          : 'Pay later recorded.'
      );
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit payment.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Admin Actions
  const handleQuickVerify = async (userId: string) => {
    if (!game) return;
    try {
      await adminQuickVerifyPlayer(game.id, userId);
      toast.success('Player marked as paid & verified!');
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to quick verify.');
    }
  };

  const handleVerifyPayment = async (paymentId: string) => {
    try {
      await adminVerifyPayment(paymentId, 'VERIFY');
      toast.success('Payment claim verified!');
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify payment.');
    }
  };

  const handleRejectPayment = async (paymentId: string, reason: string) => {
    try {
      await adminVerifyPayment(paymentId, 'REJECT', reason);
      toast.warning('Payment claim rejected.');
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject payment.');
    }
  };

  const handleRevertPayment = async (paymentId: string) => {
    try {
      await adminVerifyPayment(paymentId, 'REVERT');
      toast.info('Payment reverted to pending.');
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to revert payment.');
    }
  };

  const handleConfirmRoster = async () => {
    if (!game) return;
    try {
      await adminConfirmRoster(game.id);
      toast.success('Match roster locked & confirmed! Roster is ready for New Match.');
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm roster.');
    }
  };

  const handleSettleRefund = async (paymentId: string) => {
    try {
      await adminSettleRefund(paymentId);
      toast.success('Refund marked as settled.');
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to settle refund.');
    }
  };

  const handleSaveGame = async (gameData: Partial<Game>) => {
    try {
      const saved = await createOrUpdateGame(gameData);
      toast.success('Match scheduled successfully!');
      setGame(saved);
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save game.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-primary-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <p className="text-sm font-semibold tracking-wide text-neutral-300">Loading match & payments...</p>
      </div>
    );
  }

  // Empty state: No active game scheduled
  if (!game) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-28">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Payments & Game Roster</h1>
          <p className="text-neutral-400 mt-1 text-sm sm:text-base">
            Track match dues, player registrations, and automated UPI settlements.
          </p>
        </div>

        <div className="bg-neutral-900 border border-white/10 rounded-3xl p-8 sm:p-14 text-center shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-white/10 flex items-center justify-center text-neutral-400 mx-auto mb-4">
            <Calendar className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">No Active Match Scheduled</h2>
          <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto">
            There is currently no upcoming game open for player registration. Check back soon or ask your group admin to schedule one.
          </p>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCreateGameModal(true)}
              className="mt-6 px-6 py-3 rounded-xl bg-primary-500 hover:bg-primary-400 text-neutral-950 font-bold text-sm shadow-lg shadow-primary-500/20 inline-flex items-center gap-2 active:scale-95 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Schedule Match Day
            </button>
          )}
        </div>

        {showCreateGameModal && (
          <CreateGameModal
            existingGame={null}
            onSave={handleSaveGame}
            onClose={() => setShowCreateGameModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-32">
      {/* Page Title & Admin Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Payments & Game Roster</h1>
          <p className="text-neutral-400 mt-1 text-xs sm:text-sm">
            Live player responses, 10-player threshold unlocking, and direct UPI settlements.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => loadData(true)}
            className="p-2.5 rounded-xl bg-neutral-900 border border-white/10 text-neutral-400 hover:text-white transition-colors"
            title="Refresh Data"
            aria-label="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-primary-400' : ''}`} />
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowReconciliationModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Center</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. Game Header Card */}
      <GameHeader
        game={game}
        activeCount={activeSquad.length}
        onShareWhatsApp={() => setShowWhatsAppModal(true)}
        isAdmin={isAdmin}
        onEditGame={() => setShowCreateGameModal(true)}
      />

      {/* 2. Threshold Progress Bar */}
      <ThresholdProgressBar activeCount={activeSquad.length} squadCapacity={game.squad_capacity} />

      {/* 3. Player Attendance Dock */}
      <RegistrationDock
        currentResponse={currentRegistration?.response}
        onSelectResponse={handleSelectResponse}
        loading={submittingAction}
        disabled={isRegistrationClosed}
        disabledReason={
          isRegistrationClosed
            ? 'Match roster has been finalized & locked by admin.'
            : undefined
        }
      />

      {/* 4. Payment Section (Direct UPI, QR & Status) */}
      <PaymentSection
        game={game}
        userPayment={currentPayment}
        paymentProfiles={paymentProfiles}
        isUserInSquad={isUserInSquad}
        isUserWaitlisted={isUserWaitlisted}
        isPaymentUnlocked={isPaymentUnlocked}
        onSubmitPayment={handleSubmitPayment}
        loading={submittingAction}
      />

      {/* 5. Ordered Player Roster List */}
      <PlayerRosterList
        activeSquad={activeSquad}
        waitingList={waitingList}
        outList={outList}
        isAdmin={isAdmin}
        onQuickVerify={handleQuickVerify}
        currentUserId={user?.id}
        onOpenAddPlayer={() => setShowAddPlayerModal(true)}
      />

      {/* Modals */}
      {showAddPlayerModal && game && (
        <AdminAddPlayerModal
          isOpen={showAddPlayerModal}
          onClose={() => setShowAddPlayerModal(false)}
          gameId={game.id}
          alreadyInUserIds={activeSquad.concat(waitingList).map((p) => p.user_id)}
          amountPerPlayer={Number(game.amount_per_player)}
          onPlayerAdded={() => loadData(true)}
        />
      )}

      {showWhatsAppModal && (
        <WhatsAppSummaryModal
          game={game}
          activeSquad={activeSquad}
          waitingList={waitingList}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}

      {showReconciliationModal && (
        <AdminReconciliationModal
          game={game}
          activeSquad={activeSquad}
          allPayments={payments}
          onVerifyPayment={handleVerifyPayment}
          onRejectPayment={handleRejectPayment}
          onRevertPayment={handleRevertPayment}
          onQuickVerifyPlayer={handleQuickVerify}
          onConfirmRoster={handleConfirmRoster}
          onSettleRefund={handleSettleRefund}
          onClose={() => setShowReconciliationModal(false)}
          onNavigateToMatch={(gameId) => {
            setShowReconciliationModal(false);
            navigate(`/matches/new?game_id=${gameId}`);
          }}
        />
      )}

      {showCreateGameModal && (
        <CreateGameModal
          existingGame={game}
          onSave={handleSaveGame}
          onClose={() => setShowCreateGameModal(false)}
        />
      )}
    </div>
  );
}
