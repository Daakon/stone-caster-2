import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSession, getSessionMessages } from '@/lib/api';

function HeaderSkeleton() {
	return (
		<div className="h-6 w-48 bg-muted rounded animate-pulse" aria-hidden="true" />
	);
}

function MessageRowSkeleton() {
	return <div className="h-5 w-full bg-muted/60 rounded animate-pulse" aria-hidden="true" />;
}

function MessageListSkeleton() {
	return (
		<div className="space-y-3" aria-hidden="true">
			{Array.from({ length: 10 }).map((_, i) => (
				<MessageRowSkeleton key={i} />
			))}
		</div>
	);
}

export default function SessionPage() {
	const { id } = useParams();
	const sessionId = id as string;
	const chatHeadingRef = useRef<HTMLHeadingElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const liveRef = useRef<HTMLDivElement | null>(null);
	const [lastMessageId, setLastMessageId] = useState<string | null>(null);

	const sessionQuery = useQuery({
		queryKey: ['session', sessionId],
		queryFn: () => getSession(sessionId),
		staleTime: 5_000,
		gcTime: 10 * 60_000,
		enabled: Boolean(sessionId),
	});

	const messagesQuery = useQuery({
		queryKey: ['session', sessionId, 'messages', { limit: 20 }],
		queryFn: () => getSessionMessages(sessionId, 20),
		staleTime: 1_000,
		gcTime: 10 * 60_000,
		enabled: Boolean(sessionId),
	});

	const loading = sessionQuery.isLoading || messagesQuery.isLoading;
	const session = sessionQuery.data?.data;
	const messages = useMemo(() => messagesQuery.data?.data ?? [], [messagesQuery.data]);

	useEffect(() => {
		if (!loading && chatHeadingRef.current) {
			chatHeadingRef.current.focus();
		}
	}, [loading]);

	// announce new AI messages
	useEffect(() => {
		if (!messages || messages.length === 0) return;
		const newest = messages[messages.length - 1];
		if (newest && newest.role === 'assistant' && newest.id !== lastMessageId) {
			setLastMessageId(newest.id);
			if (liveRef.current) liveRef.current.textContent = newest.content;
		}
	}, [messages, lastMessageId]);

	useEffect(() => {
		const onHotkey = (e: KeyboardEvent) => {
			const isK = e.key.toLowerCase() === 'k';
			if (isK && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				inputRef.current?.focus();
			}
		};
		window.addEventListener('keydown', onHotkey);
		return () => window.removeEventListener('keydown', onHotkey);
	}, []);

	return (
		<div className="container mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6" aria-busy={loading ? 'true' : 'false'}>
			<header role="banner" className="min-h-8">
				{loading ? (
					<HeaderSkeleton />
				) : (
					<div className="text-sm text-muted-foreground">
						{session?.title ?? 'Story'} • {session?.character_name ?? 'Character'}
					</div>
				)}
			</header>

			<main id="chat" role="main" aria-label="Story chat" className="space-y-4" tabIndex={-1}>
				<h1 ref={chatHeadingRef} className="text-xl font-semibold outline-none">Chat</h1>
				<div aria-live="polite" className="sr-only" ref={liveRef} />
				<div className="min-h-[320px]">
					{loading ? (
						<MessageListSkeleton />
					) : (
						<ul className="space-y-3">
							{messages.map((m) => (
								<li key={m.id} className="p-3 rounded bg-accent/30">
									<span className="text-xs text-muted-foreground mr-2">{m.role === 'assistant' ? 'AI' : 'You'}</span>
									<span>{m.content}</span>
								</li>
							))}
						</ul>
					)}
				</div>

				<form role="search" aria-label="Cast your next stone" className="flex gap-2">
					<input
						ref={inputRef}
						className="flex-1 border rounded px-3 py-2"
						placeholder="Type your next message… (Ctrl/Cmd+K to focus)"
						aria-label="Message input"
					/>
					<button type="button" className="border rounded px-4 py-2">Send</button>
				</form>
			</main>

			<aside role="complementary" aria-label="Character & world" className="min-h-[240px]">
				{loading ? (
					<div className="space-y-3" aria-hidden="true">
						<div className="h-24 bg-muted rounded animate-pulse" />
						<div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
						<div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
					</div>
				) : (
					<div className="text-sm text-muted-foreground">Character and world details</div>
				)}
			</aside>
		</div>
	);
}




