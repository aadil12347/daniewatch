type Props = {
  className?: string;
  ariaLabel?: string;
};

export function InlineDotsLoader({ className, ariaLabel = "Loading" }: Props) {
  return (
    <div className={className} role="status" aria-label={ariaLabel}>
      <div className="app-loader app-loader--sm" aria-hidden="true">
        <div className="circle" />
        <div className="circle" />
        <div className="circle" />
        <div className="shadow" />
        <div className="shadow" />
        <div className="shadow" />
      </div>
    </div>
  );
}
