"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as SidebarPrimitive from "@animate-ui/react/primitives/sidebar";
import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "4.75rem";

export const useSidebar = SidebarPrimitive.useSidebar;
export const SidebarTriggerIcon = SidebarPrimitive.TriggerIcon;

/** Bọc toàn bộ layout: quản lý trạng thái thu gọn/mở rộng (và tự lưu qua cookie `sidebar_state`). */
export function SidebarProvider({
  className,
  style,
  ...props
}: React.ComponentProps<typeof SidebarPrimitive.Provider>) {
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarPrimitive.Provider
        data-slot="sidebar-wrapper"
        style={{ "--sidebar-width": SIDEBAR_WIDTH, "--sidebar-width-icon": SIDEBAR_WIDTH_ICON, ...style } as React.CSSProperties}
        className={cn("group/sidebar-wrapper flex min-h-dvh w-full", className)}
        {...props}
      />
    </TooltipProvider>
  );
}

/** Cột sidebar bên trái (chỉ desktop — mobile giữ thanh điều hướng dưới riêng).
 * Hiệu ứng: co giãn chiều rộng mượt + vệt sáng (highlight) trượt theo mục đang hover/active. */
export function Sidebar({ className, children, ...props }: React.ComponentProps<"div">) {
  const { state } = useSidebar();

  return (
    <div
      className="group peer hidden md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? "icon" : ""}
      data-slot="sidebar"
    >
      <SidebarPrimitive.Gap
        data-slot="sidebar-gap"
        className="relative w-(--sidebar-width) bg-transparent group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
      />
      <SidebarPrimitive.Container
        data-slot="sidebar-container"
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden w-(--sidebar-width) border-r border-line group-data-[collapsible=icon]:w-(--sidebar-width-icon) md:flex",
          className,
        )}
        {...props}
      >
        <SidebarPrimitive.Highlight data-slot="sidebar-inner" className="flex size-full flex-col bg-surface">
          {children}
        </SidebarPrimitive.Highlight>
      </SidebarPrimitive.Container>
    </div>
  );
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("flex flex-col gap-2 p-3", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("flex min-h-0 flex-1 flex-col overflow-auto px-3 py-1 group-data-[collapsible=icon]:overflow-hidden", className)}
      {...props}
    />
  );
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-footer" className={cn("flex flex-col gap-1 border-t border-line p-3", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-item" className={cn("group/menu-item relative", className)} {...props} />;
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button relative z-10 flex w-full items-center gap-3 overflow-hidden rounded-xl p-2.5 text-left text-sm font-medium outline-hidden transition-colors group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0! group-data-[collapsible=icon]:p-0! [&>svg]:size-5 [&>svg]:shrink-0 [&>span]:truncate group-data-[collapsible=icon]:[&>span]:hidden",
  {
    variants: {
      active: {
        true: "bg-ink text-bg",
        false: "text-ink-2 hover:text-ink",
      },
    },
    defaultVariants: { active: false },
  },
);

export function SidebarMenuButton({
  asChild = false,
  active = false,
  tooltip,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
  tooltip?: string;
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot.Root : "button";
  const { state, isMobile } = useSidebar();

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-active={active}
      className={cn(sidebarMenuButtonVariants({ active }), className)}
      {...props}
    />
  );

  if (!tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
