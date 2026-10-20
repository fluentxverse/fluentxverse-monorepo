import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { scheduleApi, AvailableSlot } from '../../api/schedule.api';
import { transferTicketForBooking, getTicketBalance, type TicketBalance } from '../../services/ticket.service';
import { getErrorMessage } from '../../api/utils';
import ProfileAvatar from '../Common/ProfileAvatar';
import { SocialLoginModal } from '../Auth/SocialLoginModal';
import { useThemeStore } from '../../context/ThemeContext';
import { useAuthContext } from '../../context/AuthContext';
import { appWallet, autoConnectWallet, connectWallet, type WalletAccount } from '../../config/wallet';
import StudentDialog from '../Common/StudentDialog';
import { X, CircleCheck, CircleAlert, Clock, ChevronRight, CalendarDays, Globe, Video, Check } from "lucide-solid";
import './BookingModal.css';
import { lessonPassApi } from '../../api/lessonPasses.api';
import type { PassMode } from '../../shared/lessonPasses';
interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    tutorId: string;
    tutorName: string;
    tutorAvatar?: string;
    hourlyRate?: number;
    preSelectedDate?: string;
    preSelectedTime?: string;
    filterDate?: string; // YYYY-MM-DD format - only show slots for this date
}
const pendingTransferKey = 'fxv:pending-booking-transfer';
type PendingTransfer = {
    hash: string;
    wallet: string;
    slotId: string;
    reservationId: string;
};
function readPendingTransfer(): PendingTransfer | null {
    try {
        const value = JSON.parse(localStorage.getItem(pendingTransferKey) || 'null');
        return value && typeof value.hash === 'string' && typeof value.wallet === 'string' &&
            typeof value.slotId === 'string' && typeof value.reservationId === 'string' ? value : null;
    }
    catch {
        return null;
    }
}
export const BookingModal = (_props0: BookingModalProps) => {
    const [availableSlots, setAvailableSlots] = createSignal<AvailableSlot[]>([]);
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [selectedSlot, setSelectedSlot] = createSignal<AvailableSlot | null>(null);
    const [activeDate, setActiveDate] = createSignal('');
    const [booking, setBooking] = createSignal(false);
    const [bookingSuccess, setBookingSuccess] = createSignal(false);
    const [ticketBalance, setTicketBalance] = createSignal<TicketBalance | null>(null);
    const [ticketLoading, setTicketLoading] = createSignal(true);
    const [transferringTicket, setTransferringTicket] = createSignal(false);
    const [unresolvedTransferHash, setUnresolvedTransferHash] = createSignal<string | null>(null);
    const isDarkMode = createMemo(() => useThemeStore((state) => state.isDarkMode));
    const _state1 = useAuthContext();
    const [showLoginModal, setShowLoginModal] = createSignal(false);
    const [connectedAccount, setConnectedAccount] = createSignal<WalletAccount | null>(appWallet.getAccount());
    const [profileWalletAddress, setProfileWalletAddress] = createSignal<string | null>(null);
    const [creditMode, setCreditMode] = createSignal<PassMode>();
    createEffect(on(() => _props0.isOpen, async open => {
        if (!open) return;
        setCreditMode(undefined);
        try { setCreditMode(await lessonPassApi.mode()); } catch (e) { setError((e as Error).message); }
    }));
    const [isWalletConnecting, setIsWalletConnecting] = createSignal(false);
    const [isWalletAutoConnecting, setIsWalletAutoConnecting] = createSignal(true);
    const walletAddress = createMemo(() => _state1.user?.walletAddress || _state1.user?.smartWalletAddress || profileWalletAddress() || connectedAccount()?.address);
    createEffect(on(() => [_props0["isOpen"], _state1.isAuthenticated, walletAddress(), creditMode()], () => {
        const _cleanup2 = untrack(() => {
            if (creditMode()?.mode !== 'legacy_erc1155' || !_props0["isOpen"] || !_state1.isAuthenticated || !walletAddress())
                return;
            const pending = readPendingTransfer();
            if (pending?.wallet.toLowerCase() === walletAddress().toLowerCase()) {
                setUnresolvedTransferHash(pending.hash);
                setError('A previous ticket transfer is awaiting booking confirmation or recovery. Check its status before booking again.');
            }
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    createEffect(on(() => [_state1.isAuthenticated, _props0["isOpen"]], () => {
        const _cleanup3 = untrack(() => {
            if (_state1.isAuthenticated || !_props0["isOpen"])
                setShowLoginModal(false);
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    createEffect(on(() => [_props0["isOpen"], _state1.isAuthenticated], () => {
        const _cleanup4 = untrack(() => {
            if (!_props0["isOpen"] || !_state1.isAuthenticated)
                return;
            let cancelled = false;
            _state1.ensureSession()
                .then((student) => {
                if (!cancelled)
                    setProfileWalletAddress(student.walletAddress || null);
            })
                .catch((err) => {
                if (!cancelled) {
                    setProfileWalletAddress(null);
                    setError(getErrorMessage(err));
                }
            });
            return () => { cancelled = true; };
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    const reconnectWallet = async () => {
        setError(null);
        setIsWalletConnecting(true);
        try {
            const account = await connectWallet();
            setConnectedAccount(account);
        }
        catch (err: any) {
            setError(err?.message || 'Unable to reconnect wallet. Please sign in with your wallet again.');
        }
        finally {
            setIsWalletConnecting(false);
        }
    };
    createEffect(on(() => [_props0["isOpen"], _state1.isAuthenticated, creditMode()], () => {
        const _cleanup5 = untrack(() => {
            let cancelled = false;
            if (creditMode()?.mode !== 'legacy_erc1155' || !_props0["isOpen"] || !_state1.isAuthenticated) {
                setIsWalletAutoConnecting(false);
                return;
            }
            setIsWalletAutoConnecting(true);
            autoConnectWallet()
                .then((account) => {
                if (!cancelled && account)
                    setConnectedAccount(account);
            })
                .finally(() => {
                if (!cancelled)
                    setIsWalletAutoConnecting(false);
            });
            return () => {
                cancelled = true;
            };
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    // Fetch ticket balance when modal opens
    createEffect(on(() => [_props0["isOpen"], _state1.isAuthenticated, walletAddress(), isWalletAutoConnecting(), isWalletConnecting(), creditMode()], () => {
        const _cleanup6 = untrack(() => {
            if (creditMode()?.mode !== 'legacy_erc1155') { setTicketLoading(false); return; }
            if (!_state1.isAuthenticated) {
                setTicketBalance(null);
                setTicketLoading(false);
            }
            else if (_props0["isOpen"] && walletAddress()) {
                setTicketLoading(true);
                getTicketBalance(walletAddress())
                    .then((balance) => {
                    setTicketBalance(balance);
                })
                    .catch((err) => {
                    console.error('[BookingModal] Error fetching ticket balance:', err);
                })
                    .finally(() => {
                    setTicketLoading(false);
                });
            }
            else if (_props0["isOpen"] && !isWalletAutoConnecting() && !isWalletConnecting()) {
                setTicketBalance(null);
                setTicketLoading(false);
            }
            else if (_props0["isOpen"]) {
                setTicketLoading(true);
            }
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    // Helper function to convert PHT time to JST time
    // Returns the ACTUAL JST date (may be next day for late-night PHT times)
    // Handles both 12-hour format (6:00 PM) and 24-hour format (18:00)
    const convertToJapaneseTimeWithDate = (phDateString: string, phTimeString: string): {
        date: string;
        time: string;
        dateRolledOver: boolean;
    } => {
        let hours: number;
        let minutes: string;
        // Trim input and normalize whitespace
        const normalizedTime = phTimeString.trim();
        // Try 12-hour format first (e.g., "6:00 PM", "11:30PM", "11:30 pm")
        const time12Match = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (time12Match) {
            hours = parseInt(time12Match[1], 10);
            minutes = time12Match[2];
            const period = time12Match[3].toUpperCase();
            // Convert to 24-hour format
            if (period === 'PM' && hours !== 12) {
                hours += 12;
            }
            else if (period === 'AM' && hours === 12) {
                hours = 0;
            }
        }
        else {
            // Try 24-hour format (e.g., "18:00", "23:30")
            const time24Match = normalizedTime.match(/^(\d{1,2}):(\d{2})$/);
            if (time24Match) {
                hours = parseInt(time24Match[1], 10);
                minutes = time24Match[2];
            }
            else {
                // Can't parse, return as-is
                return { date: phDateString, time: phTimeString, dateRolledOver: false };
            }
        }
        // Add 1 hour for Japanese timezone (UTC+9 vs UTC+8)
        hours += 1;
        // Handle hour overflow - roll to next day
        let dateRolledOver = false;
        let resultDate = phDateString;
        if (hours >= 24) {
            hours -= 24;
            dateRolledOver = true;
            // Calculate the next day manually without timezone issues
            // Parse the PHT date string and add 1 day
            const [year, month, day] = phDateString.split('-').map(Number);
            const nextDayDate = new Date(year, month - 1, day + 1);
            resultDate = `${nextDayDate.getFullYear()}-${String(nextDayDate.getMonth() + 1).padStart(2, '0')}-${String(nextDayDate.getDate()).padStart(2, '0')}`;
        }
        return { date: resultDate, time: `${String(hours).padStart(2, '0')}:${minutes}`, dateRolledOver };
    };
    // Simple time-only conversion for display (keeps original PHT date for display grouping)
    const convertToJapaneseTime = (phTimeString: string): string => {
        const result = convertToJapaneseTimeWithDate('2000-01-01', phTimeString);
        return result.time;
    };
    createEffect(on(() => [_props0["isOpen"], _props0["tutorId"]], () => {
        const _cleanup7 = untrack(() => {
            if (_props0["isOpen"] && _props0["tutorId"]) {
                fetchAvailableSlots();
            }
        });
        if (typeof _cleanup7 === "function")
            onCleanup(_cleanup7);
    }));
    // Auto-select slot when preSelectedDate/Time are provided
    // preSelectedDate is now PHT date, preSelectedTime is JST time
    // We need to find the PHT slot that matches
    createEffect(on(() => [_props0["preSelectedDate"], _props0["preSelectedTime"], availableSlots()], () => {
        const _cleanup8 = untrack(() => {
            if (_props0["preSelectedDate"] && _props0["preSelectedTime"] && availableSlots().length > 0) {
                const matchingSlot = availableSlots().find(slot => {
                    // Convert slot's PHT time to JST time for comparison
                    const jstTime = convertToJapaneseTime(slot.time);
                    // Compare PHT date directly and JST time
                    return slot.date === _props0["preSelectedDate"] && jstTime === _props0["preSelectedTime"];
                });
                if (matchingSlot) {
                    setSelectedSlot(matchingSlot);
                }
            }
        });
        if (typeof _cleanup8 === "function")
            onCleanup(_cleanup8);
    }));
    // Helper to check if a PHT slot belongs to a specific PHT date
    // The date filter now represents PHT dates (tutor's timezone)
    // Students see all slots from that PHT date, with times converted to JST for display
    // e.g., Jan 6 PHT 11:00 PM displays as Jan 7 00:00 JST, but it's still a "Jan 6" slot
    const slotBelongsToPHTDate = (slotDate: string, targetPHTDate: string): boolean => {
        return slotDate === targetPHTDate;
    };
    const fetchAvailableSlots = async () => {
        setLoading(true);
        if (!readPendingTransfer())
            setError(null);
        try {
            // filterDate is a PHT date (same as tutor's timezone)
            // We fetch slots for that exact PHT date
            const startDate = _props0["filterDate"] || new Date().toISOString().split('T')[0];
            const endDate = _props0["filterDate"] || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const slots = await scheduleApi.getAvailableSlots(_props0["tutorId"], startDate, endDate);
            // Debug: Log conversion for each slot
            if (_props0["filterDate"]) {
                slots.forEach(slot => {
                    const converted = convertToJapaneseTimeWithDate(slot.date, slot.time);
                });
            }
            // If filterDate is set, filter to show slots that belong to this PHT date
            // All slots from that PHT date are shown, with times converted to JST for display
            // e.g., Jan 6 PHT 11:00 PM -> displays as 00:00 JST (next day in JST, but still Jan 6 slot)
            const filteredSlots = _props0["filterDate"] ? slots.filter(slot => {
                const belongs = slotBelongsToPHTDate(slot.date, _props0["filterDate"]);
                const converted = convertToJapaneseTimeWithDate(slot.date, slot.time);
                return belongs;
            })
                : slots;
            setAvailableSlots(filteredSlots);
        }
        catch (err: any) {
            setError(getErrorMessage(err));
        }
        finally {
            setLoading(false);
        }
    };
    const completeBooking = (wallet?: string) => {
        if (creditMode()?.mode === 'legacy_erc1155') {
            localStorage.removeItem(pendingTransferKey);
            setUnresolvedTransferHash(null);
        }
        setBookingSuccess(true);
        if (wallet)
            getTicketBalance(wallet).then(setTicketBalance).catch(console.error);
        setTimeout(() => {
            setBookingSuccess(false);
            _props0["onClose"]();
            window.location.href = '/schedule';
        }, 2000);
    };
    const retryTransferRecovery = async () => {
        if (!unresolvedTransferHash())
            return;
        const pending = readPendingTransfer();
        if (!pending || pending.hash !== unresolvedTransferHash()) {
            setError('Transfer details are missing. Please contact support with your transaction hash.');
            return;
        }
        setBooking(true);
        try {
            const recovery = await scheduleApi.recoverTransfer(pending.hash, pending.slotId, pending.reservationId);
            if (recovery.status === 'booked') {
                completeBooking(walletAddress() || undefined);
            }
            else if (recovery.status === 'refunded') {
                localStorage.removeItem(pendingTransferKey);
                setUnresolvedTransferHash(null);
                setError('The booking did not complete. Your ticket has been returned.');
                if (walletAddress())
                    getTicketBalance(walletAddress()).then(setTicketBalance).catch(console.error);
            }
            else {
                setError(`The reservation is still being checked. Try again after it expires. Transfer: ${unresolvedTransferHash()}`);
            }
        }
        catch (err: any) {
            setError(`Ticket recovery needs support review. Keep this transfer hash: ${unresolvedTransferHash()}. ${getErrorMessage(err)}`);
        }
        finally {
            setBooking(false);
        }
    };
    const handleBookSlot = async () => {
        if (!selectedSlot())
            return;
        if (!_state1.isAuthenticated) {
            setShowLoginModal(true);
            return;
        }
        if (!creditMode()) { setError('Lesson credit configuration is unavailable. Reopen this booking.'); return; }
        if (creditMode()?.mode === 'trial') {
            setBooking(true); setError(null);
            const student = await _state1.ensureSession().catch(() => null);
            if (!student) { setBooking(false); setError('Sign in again to confirm this booking.'); return; }
            const key = `fxv:pending-trial-booking:${student.userId}`;
            try {
                let pending: { slotId: string; reservationId: string } | null = JSON.parse(localStorage.getItem(key) || 'null');
                if (!pending) {
                    const slotId = selectedSlot()!.slotId, hold = await scheduleApi.reserveSlot(slotId);
                    pending = { slotId, reservationId: hold.reservationId };
                    localStorage.setItem(key, JSON.stringify(pending));
                }
                try { await scheduleApi.bookTrial(pending.slotId, pending.reservationId); }
                catch {
                    try { await scheduleApi.bookTrial(pending.slotId, pending.reservationId); }
                    catch (e) {
                        const status = await scheduleApi.reservationStatus(pending.reservationId);
                        if (status.state === 'booked') { localStorage.removeItem(key); completeBooking(); return; }
                        if (status.state === 'held') await scheduleApi.releaseReservation(pending.slotId, pending.reservationId);
                        localStorage.removeItem(key);
                        throw e;
                    }
                }
                localStorage.removeItem(key); completeBooking();
            } catch (e) {
                // Retain the exact reservation after uncertain outcomes; retry cannot create a second booking.
                setError(getErrorMessage(e));
            } finally { setBooking(false); }
            return;
        }
        if (creditMode()?.mode === 'private_passes') {
            setBooking(true); setError(null);
            const student = await _state1.ensureSession().catch(() => null);
            if (!student) { setBooking(false); setError('Sign in again to confirm this booking.'); return; }
            const key = `fxv:pending-private-booking:${student.userId}`;
            try {
                const account = await lessonPassApi.mine();
                let pending: { slotId: string; reservationId: string; passId: string } | null = JSON.parse(localStorage.getItem(key) || 'null');
                if (pending) {
                    const old = account.reservations.find(n => n.id === pending!.passId);
                    if (old?.bookingId) { localStorage.removeItem(key); completeBooking(); return; }
                    if (!old || old.status !== 'ready') throw new Error('Previous pass booking needs support reconciliation.');
                } else {
                    const ready = account.reservations.find(n => n.status === 'ready' && !n.bookingId);
                    if (!ready) throw new Error('Prepare a lesson pass on the Lesson credits page before booking.');
                    const slotId = selectedSlot()!.slotId;
                    const hold = await scheduleApi.reserveSlot(slotId);
                    pending = { slotId, reservationId: hold.reservationId, passId: ready.id };
                    localStorage.setItem(key, JSON.stringify(pending));
                }
                try { await scheduleApi.bookWithPass(pending.slotId, pending.reservationId, pending.passId); }
                catch {
                    try { await scheduleApi.bookWithPass(pending.slotId, pending.reservationId, pending.passId); }
                    catch (e) {
                        await scheduleApi.releaseReservation(pending.slotId, pending.reservationId);
                        const fresh = await lessonPassApi.mine();
                        const saved = fresh.reservations.find(n => n.id === pending!.passId);
                        if (saved?.bookingId) { localStorage.removeItem(key); completeBooking(); return; }
                        if (saved?.status === 'ready') localStorage.removeItem(key);
                        throw e;
                    }
                }
                localStorage.removeItem(key); completeBooking();
            } catch (e) { setError((e as Error).message || 'Pass booking could not be confirmed. Try again to check its status.'); }
            finally { setBooking(false); }
            return;
        }
        if (unresolvedTransferHash()) {
            setError('Check your previous ticket transfer before booking another lesson.');
            return;
        }
        let bookingAccount: Pick<WalletAccount, 'address'> | null = walletAddress() ? { get address() {
                return walletAddress() as WalletAccount['address'];
            } }
            : connectedAccount() || appWallet.getAccount();
        if (!bookingAccount && (isWalletAutoConnecting() || isWalletConnecting())) {
            setError('Wallet is reconnecting, please wait a moment and try again.');
            return;
        }
        // Check if user has connected wallet
        if (!bookingAccount) {
            await reconnectWallet();
            bookingAccount = appWallet.getAccount();
            if (!bookingAccount) {
                setError('Please connect your wallet to book a lesson');
                return;
            }
        }
        // Wait for ticket data to load
        if (ticketLoading()) {
            setError('Loading ticket balance, please wait...');
            return;
        }
        // Check ticket balance
        const hasBasicTickets = ticketBalance() && ticketBalance().basic >= 1;
        const hasPremiumTickets = ticketBalance() && ticketBalance().premium >= 1;
        if (!hasBasicTickets && !hasPremiumTickets) {
            setError('You need at least 1 ticket to book a lesson. Please purchase tickets first.');
            return;
        }
        // Use basic tickets first, fallback to premium
        const ticketTier = hasBasicTickets ? 'basic' : 'premium';
        setBooking(true);
        setError(null);
        let reservationId: string | null = null;
        let transferHash: string | null = null;
        let completed = false;
        let refunded = false;
        try {
            // Confirm/repair the API cookie before reserving or spending a ticket.
            await _state1.ensureSession();
            const reservation = await scheduleApi.reserveSlot(selectedSlot().slotId);
            reservationId = reservation.reservationId;
            if (Date.now() >= Date.parse(reservation.bookBy)) {
                throw new Error('The booking deadline for this slot has passed. Please choose another time.');
            }
            setTransferringTicket(true);
            const transferResult = await transferTicketForBooking(bookingAccount, ticketTier as 'basic' | 'premium', 1);
            if (!transferResult.success) {
                throw new Error(transferResult.error || 'Failed to transfer ticket');
            }
            if (!transferResult.transactionHash)
                throw new Error('Ticket transfer hash is unavailable');
            transferHash = transferResult.transactionHash;
            localStorage.setItem(pendingTransferKey, JSON.stringify({
                hash: transferHash, wallet: bookingAccount.address,
                get slotId() {
                    return selectedSlot().slotId;
                },
                reservationId
            } satisfies PendingTransfer));
            setUnresolvedTransferHash(transferHash);
            setTransferringTicket(false);
            try {
                await scheduleApi.bookSlot(selectedSlot().slotId, transferHash, reservationId);
            }
            catch {
                await scheduleApi.bookSlot(selectedSlot().slotId, transferHash, reservationId);
            }
            completed = true;
            completeBooking(bookingAccount.address);
        }
        catch (err: any) {
            console.error('❌ Booking failed:', err);
            if (transferHash) {
                try {
                    const recovery = await scheduleApi.recoverTransfer(transferHash, selectedSlot().slotId, reservationId!);
                    if (recovery.status === 'booked') {
                        completed = true;
                        completeBooking(bookingAccount.address);
                    }
                    else if (recovery.status === 'refunded') {
                        refunded = true;
                        localStorage.removeItem(pendingTransferKey);
                        setUnresolvedTransferHash(null);
                        setError('The slot could not be booked. Your ticket has been returned.');
                        getTicketBalance(bookingAccount.address).then(setTicketBalance).catch(console.error);
                    }
                    else {
                        setError(`The reservation is still being checked. Try again after it expires. Transfer: ${transferHash}`);
                    }
                }
                catch (recoveryError: any) {
                    setError(`Booking could not be confirmed. Keep this transfer hash: ${transferHash}. ${getErrorMessage(recoveryError)}`);
                }
            }
            else {
                setError(getErrorMessage(err));
            }
        }
        finally {
            if (reservationId && !completed && (!transferHash || refunded)) {
                await scheduleApi.releaseReservation(selectedSlot().slotId, reservationId).catch(console.error);
            }
            setBooking(false);
            setTransferringTicket(false);
        }
    };
    const handleClose = () => {
        if (!booking() && !bookingSuccess()) {
            setSelectedSlot(null);
            setError(null);
            setBookingSuccess(false);
            setAvailableSlots([]);
            _props0["onClose"]();
        }
    };
    // Helper to check if a slot has already elapsed (for today's date in JST)
    const isSlotElapsed = (slotDate: string, slotTime: string): boolean => {
        // Get current time in JST (Japan Standard Time, UTC+9)
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const jstTime = new Date(utcTime + (9 * 60 * 60000)); // UTC+9
        // Format today's date in JST without using toISOString (which converts to UTC)
        const todayJST = `${jstTime.getFullYear()}-${String(jstTime.getMonth() + 1).padStart(2, '0')}-${String(jstTime.getDate()).padStart(2, '0')}`;
        // Convert slot PHT date/time to actual JST date/time
        const { date: jstDate, time: jstTimeStr } = convertToJapaneseTimeWithDate(slotDate, slotTime);
        // If slot's JST date is in the future, not elapsed
        if (jstDate > todayJST) {
            return false;
        }
        // If slot's JST date is in the past, it's elapsed
        if (jstDate < todayJST) {
            return true;
        }
        // Same day - check time
        const [slotHours, slotMinutes] = jstTimeStr.split(':').map(Number);
        const slotTotalMinutes = slotHours * 60 + slotMinutes;
        const nowTotalMinutes = jstTime.getHours() * 60 + jstTime.getMinutes();
        // Slot is elapsed if its time has already passed
        return slotTotalMinutes <= nowTotalMinutes;
    };
    // Display Japan dates while retaining the original PHT slot for booking.
    const slotsByDate = createMemo(() => availableSlots().reduce((acc, slot) => {
        // Skip elapsed slots
        if (isSlotElapsed(slot.date, slot.time)) {
            return acc;
        }
        const display = convertToJapaneseTimeWithDate(slot.date, slot.time);
        if (!acc[display.date]) {
            acc[display.date] = new Map<string, AvailableSlot>();
        }
        // Only keep one slot per time (first one wins)
        if (!acc[display.date].has(display.time)) {
            acc[display.date].set(display.time, slot);
        }
        return acc;
    }, {} as Record<string, Map<string, AvailableSlot>>));
    // Convert Map values back to arrays
    const dedupedSlotsByDate = createMemo(() => Object.entries(slotsByDate()).reduce((acc, [date, slotsMap]) => {
        acc[date] = Array.from(slotsMap.values()).sort((a, b) => convertToJapaneseTime(a.time).localeCompare(convertToJapaneseTime(b.time)));
        return acc;
    }, {} as Record<string, AvailableSlot[]>));
    const formatDate = (dateString: string) => {
        // Dates supplied here have already been converted to the displayed Japan day.
        const date = new Date(dateString + 'T00:00:00');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
    };
    const formatTime = (timeString: string) => {
        // Convert Philippine time to Japanese time (add 1 hour) - returns 24h format
        return convertToJapaneseTime(timeString);
    };
    const dates = createMemo(() => Object.keys(dedupedSlotsByDate()).sort());
    createEffect(() => {
        const chosen = selectedSlot();
        const chosenDate = chosen ? convertToJapaneseTimeWithDate(chosen.date, chosen.time).date : null;
        if (chosenDate && dates().includes(chosenDate)) setActiveDate(chosenDate);
        else if (!dates().includes(activeDate())) setActiveDate(dates()[0] || '');
    });
    const selectedDate = createMemo(() => selectedSlot()
        ? convertToJapaneseTimeWithDate(selectedSlot()!.date, selectedSlot()!.time).date : '');
    const duration = createMemo(() => {
        const slot = selectedSlot() || availableSlots()[0];
        const raw = slot?.durationMinutes;
        return typeof raw === 'object' && raw !== null ? Number((raw as any).low) : Number(raw);
    });
    const bookingCost = createMemo(() => creditMode()?.mode === 'trial' ? 'Free trial / no ticket charged'
        : creditMode()?.mode === 'private_passes' ? '1 prepared lesson pass'
        : creditMode()?.mode === 'legacy_erc1155' ? ticketLoading() ? 'Checking ticket balance...'
            : ticketBalance()?.basic ? '1 Basic ticket' : ticketBalance()?.premium ? '1 Premium ticket' : '1 ticket required'
        : 'Checking lesson credit...');
    const chooseDate = (date: string) => {
        if (date !== activeDate()) {
            setSelectedSlot(null);
            setActiveDate(date);
        }
    };
    return createMemo(() => {
        if (!_props0["isOpen"])
            return null;
        if (showLoginModal())
            return <SocialLoginModal isOpen onClose={() => setShowLoginModal(false)}/>;
        return (<StudentDialog className={`booking-dialog${isDarkMode() ? ' booking-dialog--dark' : ''}`} label={`Book a lesson with ${_props0["tutorName"]}`} onClose={handleClose} busy={booking() || bookingSuccess()}>
      <div class={`booking-modal${isDarkMode() ? ' booking-modal--dark' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button class="student-dialog-close booking-modal-close" onClick={handleClose} disabled={booking() || bookingSuccess()} aria-label="Close booking">
          <X size={18}/>
        </button>

        {/* Header */}
        <div class="booking-modal-header">
          <div class="booking-modal-tutor">
            <ProfileAvatar src={_props0["tutorAvatar"]} alt={_props0["tutorName"]} className="booking-modal-avatar" fallbackClassName="booking-modal-avatar-placeholder" fallback={_props0["tutorName"].charAt(0).toUpperCase()}/>
            <div class="booking-modal-tutor-info">
              <h2 class="booking-modal-title">Book a Lesson</h2>
              <p class="booking-modal-tutor-name">{_props0["tutorName"]}</p>
            </div>
          </div>
          <div class="booking-modal-facts">
            <span><Video size={15}/>1-on-1 lesson</span>
            {duration() > 0 && <span><Clock size={15}/>{duration()} minutes</span>}
            <span class="booking-modal-timezone"><Globe size={15}/>Japan time <strong>JST</strong></span>
          </div>
        </div>

        {/* Success Message */}
        {bookingSuccess() && (<div class="booking-modal-success">
            <div class="booking-modal-success-icon">
              <CircleCheck size={40}/>
            </div>
            <h3>Booking Confirmed!</h3>
            <p>Redirecting to your schedule...</p>
          </div>)}

        {/* Loading State */}
        {loading() && !bookingSuccess() && (<div class="booking-modal-loading" role="status">
            <div class="booking-modal-spinner"></div>
            <p>Loading available slots...</p>
          </div>)}

        {/* Error State */}
        {error() && !bookingSuccess() && (<div class="booking-modal-error" role="alert">
            <CircleAlert size={20}/>
            <span>{error()}</span>
            <button onClick={unresolvedTransferHash() ? retryTransferRecovery : error().toLowerCase().includes('wallet') ? reconnectWallet : fetchAvailableSlots} class="booking-modal-retry" disabled={isWalletConnecting() || isWalletAutoConnecting()}>
              {isWalletConnecting() || isWalletAutoConnecting() ? 'Connecting...' : unresolvedTransferHash() ? 'Check Ticket' : 'Retry'}
            </button>
          </div>)}

        {/* Available Slots */}
        {!loading() && !bookingSuccess() && !error() && (<>
            <div class="booking-modal-content">
              {dates().length === 0 ? (<div class="booking-modal-empty">
                  <img src="/assets/img/home-icons/schedule-v1.webp" alt="" width="64" height="64"/>
                  <p>No available slots for this date</p>
                  <small>Please check another date or try another tutor</small>
                </div>) : (<div class="booking-modal-slots">
                  {dates().length > 1 && <div class="booking-modal-date-picker" role="group" aria-label="Lesson date">
                    {dates().map(date => {
                        const day = new Date(`${date}T12:00:00`);
                        return <button class="booking-modal-date" aria-label={formatDate(date)} aria-pressed={activeDate() === date}
                          disabled={booking()} onClick={() => chooseDate(date)}>
                          <span>{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          <strong>{day.getDate()}</strong>
                          <span>{day.toLocaleDateString('en-US', { month: 'short' })}</span>
                        </button>;
                    })}
                  </div>}
                  <div class="booking-modal-date-group">
                    <div class="booking-modal-date-heading">
                      <h3 class="booking-modal-date-header"><CalendarDays size={18}/>{activeDate() ? formatDate(activeDate()) : ''}</h3>
                      <span class="booking-modal-availability">{dedupedSlotsByDate()[activeDate()]?.length || 0} available</span>
                    </div>
                    <div class="booking-modal-time-grid" role="group" aria-label="Available lesson times in Japan Standard Time">
                      {(dedupedSlotsByDate()[activeDate()] || []).map(slot => <button
                        class={`booking-modal-time-slot ${selectedSlot()?.slotId === slot.slotId ? 'selected' : ''}`}
                        aria-label={`${formatTime(slot.time)} JST`} aria-pressed={selectedSlot()?.slotId === slot.slotId}
                        disabled={booking()} onClick={() => setSelectedSlot(slot)}>
                        <span>{formatTime(slot.time)}</span><Check size={16} aria-hidden="true"/>
                      </button>)}
                    </div>
                  </div>
                </div>)}
            </div>

            {/* Footer */}
            {dates().length > 0 && (<div class="booking-modal-footer">
                <output class="booking-modal-selected-info" aria-live="polite">
                  <span class="booking-modal-summary-label">Lesson time</span>
                  {selectedSlot() ? <><strong>{formatTime(selectedSlot()!.time)} JST <span class="booking-modal-duration">{duration() > 0 ? `/ ${duration()} min` : ''}</span></strong>
                    <span class="booking-modal-summary-date">{formatDate(selectedDate())}</span></>
                    : <strong class="booking-modal-unselected">Not selected</strong>}
                  <span class="booking-modal-credit">{bookingCost()}</span>
                </output>
                <button class="booking-modal-confirm" onClick={handleBookSlot} disabled={!selectedSlot() || booking() || !creditMode() || (creditMode()?.mode === 'legacy_erc1155' && _state1.isAuthenticated && (ticketLoading() || isWalletConnecting() || isWalletAutoConnecting()))}>
                  {booking() ? (<>
                      <span class="booking-modal-spinner-small"></span>
                      Booking...
                    </>) : !_state1.isAuthenticated ? (<>Sign In to Book</>) : creditMode()?.mode === 'trial' ? (<>Book Free Trial<ChevronRight size={18}/></>) : creditMode()?.mode === 'private_passes' ? (<>Confirm with lesson pass<ChevronRight size={18}/></>) : isWalletConnecting() || isWalletAutoConnecting() ? (<>
                      <span class="booking-modal-spinner-small"></span>
                      Connecting wallet...
                    </>) : ticketLoading() ? (<>
                      <span class="booking-modal-spinner-small"></span>
                      Loading...
                    </>) : (<>
                      Confirm Booking
                      <ChevronRight size={18}/>
                    </>)}
                </button>
              </div>)}
          </>)}
      </div>
    </StudentDialog>);
    }) as unknown as JSX.Element;
};
