// pages/index.tsx
import { useEffect, useMemo, useState, ReactNode } from "react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { useActiveAccount, ConnectButton } from "thirdweb/react";
import { useRouter } from "next/router";
import { CHAIN } from "@/lib/chain";
import { thirdwebClient } from "@/lib/thirdweb";
import { motion, AnimatePresence } from "framer-motion";

// --- TYPE DEFINITIONS ---
type QualifiedRole = { roleId: string; roleName: string; required: number; owned: number };
type CheckResult = { wallets: string[]; qualifiedRoles: QualifiedRole[]; claimedRoles: string[]; qualifies: boolean };
type UserSession = { loggedIn: boolean; address?: string };
type StatusType = "info" | "success" | "error" | "loading";

// --- ICONS ---
const WalletIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v4"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M16 12a2 2 0 1 0 4 0a2 2 0 0 0-4 0Z"/></svg>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const LinkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"/></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;

// --- CUSTOM HOOK for logic and state ---
const useVerification = () => {
    const account = useActiveAccount();
    const router = useRouter();
    const { guildId, userId } = router.query as { guildId?: string; userId?: string };

    const [status, setStatus] = useState("Follow the steps to get your roles.");
    const [statusType, setStatusType] = useState<StatusType>("info");
    const [check, setCheck] = useState<CheckResult | null>(null);
    const [user, setUser] = useState<UserSession>({ loggedIn: false });
    const [discordLinked, setDiscordLinked] = useState(false);
    const [walletLinked, setWalletLinked] = useState(false);
    const [claimingRole, setClaimingRole] = useState<string | null>(null);

    const wallets = useMemo(() => [inAppWallet(), createWallet("io.metamask"), createWallet("com.coinbase.wallet")], []);

    const updateStatus = (message: string, type: StatusType) => {
        setStatus(message);
        setStatusType(type);
    };

    useEffect(() => {
        if (!router.isReady) return;
        fetch("/api/siwe/user").then((r) => r.json()).then(setUser);
        fetch("/api/discord/status").then((r) => r.json()).then((d) => setDiscordLinked(d.linked));
    }, [router.isReady]);

    useEffect(() => {
        if (account && user.loggedIn && account.address.toLowerCase() !== user.address?.toLowerCase()) {
            const handleWalletChange = async () => {
                await fetch('/api/siwe/logout', { method: 'POST' });
                setUser({ loggedIn: false });
                setWalletLinked(false);
                setCheck(null);
                updateStatus("Wallet changed. Please sign in with the new wallet.", "info");
            };
            handleWalletChange();
        }
    }, [account, user]);

    async function siweLogin() {
        if (!account) return updateStatus("Please connect your wallet first.", "error");
        updateStatus("Check your wallet to sign...", "loading");
        try {
            const res = await fetch("/api/siwe/challenge");
            const { nonce } = await res.json();
            if (!res.ok) throw new Error("Failed to get nonce");
            const message = `Sign in to verify your asset ownership.\n\nNonce: ${nonce}`;
            const signature = await account.signMessage({ message });
            const verifyRes = await fetch("/api/siwe/verify", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address: account.address, signature, message }),
            });
            if (!verifyRes.ok) throw new Error("Signature verification failed.");
            updateStatus("Wallet sign-in successful!", "success");
            const updatedUser = await fetch("/api/siwe/user").then((r) => r.json());
            setUser(updatedUser);
        } catch (e: any) {
            updateStatus(e.message || "An error occurred during sign-in.", "error");
        }
    }

    async function linkWallet() {
        updateStatus("Linking your wallet to Discord...", "loading");
        try {
            const res = await fetch("/api/link-wallet", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Link failed");
            setWalletLinked(true);
            updateStatus(`Wallet ${account?.address.slice(0, 6)}... linked!`, "success");
        } catch (e: any) {
            updateStatus(e.message, "error");
        }
    }

    async function checkRoles() {
        updateStatus("Checking your eligibility...", "loading");
        setCheck(null);
        try {
            const res = await fetch("/api/check-roles", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ guildId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Check failed");
            setCheck(data);
            updateStatus(
                data.qualifies ? "You are eligible for new roles! Claim below." : "You do not meet the requirements for any new roles.",
                data.qualifies ? "success" : "info"
            );
        } catch (e: any) {
            updateStatus(e.message, "error");
        }
    }

    async function grantRole(roleId: string) {
        setClaimingRole(roleId);
        updateStatus("Granting role...", "loading");
        try {
            const res = await fetch("/api/discord/add-role", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ guildId, roleId }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Grant failed");
            }
            updateStatus("Role granted successfully! Refreshing...", "success");
            await checkRoles();
        } catch (e: any) {
            updateStatus(e.message, "error");
        } finally {
            setClaimingRole(null);
        }
    }

    return {
        account,
        guildId,
        userId,
        status,
        statusType,
        check,
        user,
        discordLinked,
        walletLinked,
        claimingRole,
        wallets,
        siweLogin,
        linkWallet,
        checkRoles,
        grantRole,
    };
};

// --- UI COMPONENTS ---
const StepCard = ({ children, isComplete, icon }: { children: ReactNode; isComplete: boolean; icon: ReactNode; }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`relative overflow-hidden rounded-2xl border p-5 shadow-lg transition-all duration-500 ${isComplete ? "bg-gray-800/50 border-green-500/30" : "bg-gray-800/30 border-gray-700/50"}`}
    >
        <div className="flex items-start gap-4">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-all duration-300 ${isComplete ? "bg-green-500" : "bg-gray-600"}`}>
                {icon}
            </div>
            <div className="w-full space-y-3">{children}</div>
        </div>
    </motion.div>
);

const ActionButton = ({ onClick, children, className = "", disabled = false }: { onClick: () => void; children: ReactNode; className?: string; disabled?: boolean; }) => (
    <motion.button
        whileHover={{ scale: disabled ? 1 : 1.03, y: disabled ? 0 : -2 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        onClick={onClick}
        disabled={disabled}
        className={`w-full rounded-lg px-5 py-2.5 text-base font-semibold text-white shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
        {children}
    </motion.button>
);

const StatusDisplay = ({ message, type }: { message: string; type: StatusType }) => {
    const colors = {
        info: "text-gray-400",
        success: "text-green-400",
        error: "text-red-400",
        loading: "text-blue-400",
    };
    return <p className={`mt-3 h-6 text-center font-medium transition-colors ${colors[type]}`}>{message}</p>;
};

const RoleItem = ({ role, isClaimed, claimingRole, onGrant }: { role: QualifiedRole; isClaimed: boolean; claimingRole: string | null; onGrant: (roleId: string) => void; }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center justify-between rounded-lg p-3 shadow-inner transition-all duration-300 ${isClaimed ? "bg-green-900/40" : "bg-gray-700/50"}`}
    >
        <div>
            <p className="font-bold text-white">{role.roleName}</p>
            <p className="text-sm text-gray-400">Required: {role.required} | You have: {role.owned}</p>
        </div>
        <button
            onClick={() => onGrant(role.roleId)}
            className={`rounded-md px-4 py-1.5 text-sm font-bold text-white shadow-sm transition-all duration-200 ${isClaimed ? "bg-gray-600 cursor-not-allowed" : "bg-green-600 hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20"}`}
            disabled={isClaimed || claimingRole === role.roleId}
        >
            {claimingRole === role.roleId ? "Claiming..." : isClaimed ? "Claimed" : "Claim"}
        </button>
    </motion.div>
);


const ConnectWalletStep = ({ isComplete, wallets }: { isComplete: boolean; wallets: any[] }) => (
    <StepCard isComplete={isComplete} icon={<WalletIcon />}>
        <h3 className="text-lg font-semibold text-white">Connect Wallet</h3>
        <p className="text-sm text-gray-400">Connect the wallet that holds your assets.</p>
        <ConnectButton
            client={thirdwebClient}
            wallets={wallets}
            chain={CHAIN}
            theme={"dark"}
            connectButton={{ style: { width: "100%", borderRadius: '0.5rem', padding: '10px' } }}
        />
    </StepCard>
);

const SignInStep = ({ isComplete, user, onSignIn }: { isComplete: boolean; user: UserSession; onSignIn: () => void }) => (
    <StepCard isComplete={isComplete} icon={<UserIcon />}>
        <h3 className="text-lg font-semibold text-white">Sign In with Wallet</h3>
        <p className="text-sm text-gray-400">Sign a message to prove you own this wallet.</p>
        {!user.loggedIn ? (
            <ActionButton onClick={onSignIn} className="bg-blue-600 hover:bg-blue-500">Sign In</ActionButton>
        ) : (
            <p className="font-semibold text-green-400">✓ Signed in as: {user.address?.slice(0, 6)}...{user.address?.slice(-4)}</p>
        )}
    </StepCard>
);

const LinkAccountsStep = ({ isComplete, discordLinked, walletLinked, guildId, userId, onLinkWallet }: { isComplete: boolean; discordLinked: boolean; walletLinked: boolean; guildId?: string; userId?: string; onLinkWallet: () => void }) => (
    <StepCard isComplete={isComplete} icon={<LinkIcon />}>
        <h3 className="text-lg font-semibold text-white">Link Accounts</h3>
        <p className="text-sm text-gray-400">Link your Discord account to your wallet.</p>
        <div className="space-y-2.5">
            {!discordLinked ? (
                <a href={`/api/discord/login?guildId=${guildId}&userId=${userId}`} className="block w-full text-center rounded-lg bg-indigo-600 px-5 py-2.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500">
                    1. Link Discord
                </a>
            ) : (
                <p className="font-semibold text-green-400">✓ Discord linked.</p>
            )}
            {discordLinked && !walletLinked && (
                <ActionButton onClick={onLinkWallet} className="bg-teal-600 hover:bg-teal-500">
                    2. Link Current Wallet
                </ActionButton>
            )}
            {discordLinked && walletLinked && (
                <p className="font-semibold text-green-400">✓ Wallet linked to Discord.</p>
            )}
        </div>
    </StepCard>
);

const VerifyRolesStep = ({ isComplete, onCheckRoles }: { isComplete: boolean; onCheckRoles: () => void }) => (
    <StepCard isComplete={isComplete} icon={<CheckIcon />}>
        <h3 className="text-lg font-semibold text-white">Verify & Claim Roles</h3>
        <p className="text-sm text-gray-400">Check your wallets against all role gates.</p>
        <ActionButton onClick={onCheckRoles} className="bg-purple-600 hover:bg-purple-500">
            Check My Eligibility
        </ActionButton>
    </StepCard>
);

const ResultsCard = ({ check, claimingRole, onGrantRole }: { check: CheckResult | null; claimingRole: string | null; onGrantRole: (roleId: string) => void }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-4 p-5 rounded-2xl border border-gray-700/50 bg-gray-900/50 shadow-lg"
    >
        <h3 className="text-lg font-semibold text-white">Verification Results</h3>
        {check && check.qualifiedRoles.length > 0 ? (
            <div className="space-y-2.5">
                {check.qualifiedRoles.map((role) => (
                    <RoleItem
                        key={role.roleId}
                        role={role}
                        isClaimed={check.claimedRoles.includes(role.roleId)}
                        claimingRole={claimingRole}
                        onGrant={onGrantRole}
                    />
                ))}
            </div>
        ) : (
            <p className="text-center text-gray-400">No eligible roles found for your connected wallets.</p>
        )}
    </motion.div>
);


// --- MAIN PAGE COMPONENT ---
export default function Home() {
    const {
        account,
        guildId,
        userId,
        status,
        statusType,
        check,
        user,
        discordLinked,
        walletLinked,
        claimingRole,
        wallets,
        siweLogin,
        linkWallet,
        checkRoles,
        grantRole,
    } = useVerification();

    const isStep1Complete = !!account;
    const isStep2Complete = isStep1Complete && user.loggedIn;
    const isStep3Complete = isStep2Complete && discordLinked && walletLinked;
    const isStep4Complete = isStep3Complete && check !== null;

    if (!guildId || !userId) {
        return (
            <main className="flex min-h-screen items-center justify-center p-4 text-center bg-gray-950">
                <div className="w-full max-w-md p-8 space-y-4 bg-gray-900/80 rounded-2xl shadow-xl border border-gray-700">
                    <h1 className="text-3xl font-bold text-white">Invalid Link</h1>
                    <p className="text-gray-300">Please use the `/verify` command in your Discord server to get a valid link.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-gray-950 text-white">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent drop-shadow-md">
                        Role Verification
                    </h1>
                    <StatusDisplay message={status} type={statusType} />
                </div>

                <div className="space-y-4">
                    <ConnectWalletStep isComplete={isStep1Complete} wallets={wallets} />

                    <AnimatePresence>
                        {isStep1Complete && <SignInStep isComplete={isStep2Complete} user={user} onSignIn={siweLogin} />}
                    </AnimatePresence>

                    <AnimatePresence>
                        {isStep2Complete && <LinkAccountsStep isComplete={isStep3Complete} discordLinked={discordLinked} walletLinked={walletLinked} guildId={guildId} userId={userId} onLinkWallet={linkWallet} />}
                    </AnimatePresence>

                    <AnimatePresence>
                        {isStep3Complete && <VerifyRolesStep isComplete={isStep4Complete} onCheckRoles={checkRoles} />}
                    </AnimatePresence>
                </div>

                <AnimatePresence>
                    {isStep4Complete && <ResultsCard check={check} claimingRole={claimingRole} onGrantRole={grantRole} />}
                </AnimatePresence>
            </div>
        </main>
    );
}
