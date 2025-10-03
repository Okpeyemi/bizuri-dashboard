"use client"

import {useTransition} from "react";
import {useLocale, useTranslations} from "next-intl";
import {Languages, Check} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setUserLocale } from "@/services/locale";
import type { Locale } from "@/i18n/config";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("LocaleSwitcher");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const changeLocale = (value: Locale) => {
    if (value === locale) return;
    startTransition(async () => {
      await setUserLocale(value);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={isPending}>
          <Languages className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t("label")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => changeLocale("en")}> 
          <span className="mr-2 inline-flex w-4 justify-center">
            {locale === "en" ? <Check className="h-4 w-4" /> : null}
          </span>
          {t("en")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLocale("fr")}> 
          <span className="mr-2 inline-flex w-4 justify-center">
            {locale === "fr" ? <Check className="h-4 w-4" /> : null}
          </span>
          {t("fr")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
