export function LoadingState({ label }: { label: string }) {
	return (
		<div className="sa-state" role="status">
			<span aria-hidden="true" className="sa-loader" />
			<strong>{label}</strong>
			<span>Reading persisted Core state…</span>
		</div>
	);
}

export function EmptyState({
	detail,
	title,
}: {
	detail: string;
	title: string;
}) {
	return (
		<div className="sa-state">
			<span aria-hidden="true" className="sa-empty-mark">
				00
			</span>
			<strong>{title}</strong>
			<span>{detail}</span>
		</div>
	);
}

export function ErrorBanner({ message }: { message: string }) {
	return (
		<div className="sa-banner error" role="alert">
			<strong>Safe Actions request failed</strong>
			<span>{message}</span>
		</div>
	);
}

export function SuccessBanner({ message }: { message: string }) {
	return (
		<div className="sa-banner success" role="status">
			<strong>Recorded</strong>
			<span>{message}</span>
		</div>
	);
}
