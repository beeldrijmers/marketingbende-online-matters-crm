import { Check, Copy, ExternalLink, Mail } from "lucide-react";
import { useTranslate } from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const buildGmailComposeUrl = (bcc: string) => {
  const searchParams = new URLSearchParams({
    view: "cm",
    fs: "1",
    bcc,
  });
  return `https://mail.google.com/mail/?${searchParams.toString()}`;
};

export const GmailComposeButton = ({
  bcc,
  className,
}: {
  bcc: string;
  className?: string;
}) => {
  const translate = useTranslate();
  const label = translate("crm.common.open_gmail_with_bcc", {
    _: "Open Gmail with the CRM address in Bcc",
  });

  return (
    <Button asChild variant="outline" className={`w-full ${className ?? ""}`}>
      <a
        href={buildGmailComposeUrl(bcc)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
      >
        <Mail className="size-4" />
        {label}
        <ExternalLink className="size-3.5 text-muted-foreground" />
      </a>
    </Button>
  );
};

export const CopyPaste = ({ value }: { value: string }) => {
  const translate = useTranslate();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    setCopied(true);
    navigator.clipboard.writeText(value);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={handleCopy}
            variant="ghost"
            className="normal-case justify-between w-full"
          >
            <span className="overflow-hidden text-ellipsis">{value}</span>
            {copied ? (
              <Check className="h-4 w-4 ml-2" />
            ) : (
              <Copy className="h-4 w-4 ml-2" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {copied
              ? translate("crm.common.copied")
              : translate("crm.common.copy")}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
