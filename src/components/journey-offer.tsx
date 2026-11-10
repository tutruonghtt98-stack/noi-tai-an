"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { respondToJourneyOffer } from "@/actions/journey";
import { JourneyCommitmentForm } from "@/components/journey-commitment-form";

export function JourneyOffer({ pendingOffer }: { pendingOffer: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<"intro" | "setup">("intro");
  const open = pendingOffer && !dismissed;

  const decline = () => {
    exec(() => respondToJourneyOffer(false), {
      success: t.journeyOffer.responseSaved,
      onSuccess: () => {
        setDismissed(true);
        router.refresh();
      },
    });
  };

  return (
    <Modal open={open} onClose={() => !pending && decline()} title={step === "intro" ? t.journeyOffer.title : "Thiết lập hành trình"}>
      {step === "intro" ? (
        <>
          <p className="text-sm leading-6 text-ink-2">{t.journeyOffer.description}</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => setStep("setup")}>
              <ArrowRight className="size-4" aria-hidden /> {t.journeyOffer.startToday}
            </button>
            <button type="button" className="btn btn-soft" disabled={pending} onClick={decline}>
              <X className="size-4" aria-hidden /> {t.journeyOffer.decline}
            </button>
          </div>
        </>
      ) : (
        <JourneyCommitmentForm onDone={() => setDismissed(true)} />
      )}
    </Modal>
  );
}
