import styles from "./safe-actions.module.css";
export function LoadingState({ label }: { label: string }) {
	return (
		<div className={styles["sa-state"]} role="status">
			<span aria-hidden="true" className={styles["sa-loader"]} />
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
		<div className={styles["sa-state"]}>
			<span aria-hidden="true" className={styles["sa-empty-mark"]}>
				00
			</span>
			<strong>{title}</strong>
			<span>{detail}</span>
		</div>
	);
}

export function ErrorBanner({ message }: { message: string }) {
	return (
		<div className={`${styles["sa-banner"]} ${styles.error}`} role="alert">
			<strong>Safe Actions request failed</strong>
			<span>{message}</span>
		</div>
	);
}

export function SuccessBanner({ message }: { message: string }) {
	return (
		<div className={`${styles["sa-banner"]} ${styles.success}`} role="status">
			<strong>Recorded</strong>
			<span>{message}</span>
		</div>
	);
}
