import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Menu, Plus, Trash2, GripVertical, Home, User, Settings, Info, PanelLeft, LayoutGrid } from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  url: string;
  icon: string;
}

type NavigationType = "tabs" | "drawer";

interface NavigationStepProps {
  enableNavigation: boolean;
  setEnableNavigation: (enabled: boolean) => void;
  navItems: NavItem[];
  setNavItems: (items: NavItem[]) => void;
  navigationType: NavigationType;
  setNavigationType: (type: NavigationType) => void;
}

const iconOptions = [
  { value: "home", icon: Home, label: "Home" },
  { value: "user", icon: User, label: "Profile" },
  { value: "settings", icon: Settings, label: "Settings" },
  { value: "info", icon: Info, label: "About" },
  { value: "menu", icon: Menu, label: "Menu" },
];

const NavigationStep = ({
  enableNavigation,
  setEnableNavigation,
  navItems,
  setNavItems,
  navigationType,
  setNavigationType,
}: NavigationStepProps) => {
  const addNavItem = () => {
    const newItem: NavItem = {
      id: Date.now().toString(),
      label: "",
      url: "",
      icon: "home",
    };
    setNavItems([...navItems, newItem]);
  };

  const updateNavItem = (id: string, field: keyof NavItem, value: string) => {
    setNavItems(
      navItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const removeNavItem = (id: string) => {
    setNavItems(navItems.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Menu className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Navigation Menu</h2>
        <p className="text-muted-foreground">
          Add navigation to your app with tabs or a drawer menu
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-6">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-accent/50">
          <div>
            <Label htmlFor="enable-nav" className="font-medium">
              Enable Navigation
            </Label>
            <p className="text-sm text-muted-foreground">
              Add navigation menu to your app
            </p>
          </div>
          <Switch
            id="enable-nav"
            checked={enableNavigation}
            onCheckedChange={setEnableNavigation}
          />
        </div>

        {enableNavigation && (
          <>
            {/* Navigation Type Selector */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Navigation Style</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setNavigationType("tabs")}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    navigationType === "tabs"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <LayoutGrid className="w-8 h-8 text-primary" />
                    <span className="font-medium">Bottom Tabs</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Tab bar at the bottom of the screen
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => setNavigationType("drawer")}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    navigationType === "drawer"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <PanelLeft className="w-8 h-8 text-primary" />
                    <span className="font-medium">Drawer Menu</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Slide-out menu from the left
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Navigation Items */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Menu Items</Label>
              {navItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card"
                >
                  <div className="pt-2 text-muted-foreground cursor-grab">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Label</Label>
                        <Input
                          placeholder="Home"
                          value={item.label}
                          onChange={(e) =>
                            updateNavItem(item.id, "label", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">URL Path</Label>
                        <Input
                          placeholder="/home"
                          value={item.url}
                          onChange={(e) =>
                            updateNavItem(item.id, "url", e.target.value)
                          }
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Icon</Label>
                      <div className="flex gap-2 flex-wrap">
                        {iconOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => updateNavItem(item.id, "icon", opt.value)}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                              item.icon === opt.value
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                            }`}
                            title={opt.label}
                          >
                            <opt.icon className="w-5 h-5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => removeNavItem(item.id)}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>

            {navItems.length < 8 && (
              <Button
                variant="outline"
                onClick={addNavItem}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Menu Item
              </Button>
            )}

            {/* Preview */}
            {navItems.length > 0 && (
              <div className="mt-8">
                <Label className="text-sm font-medium mb-3 block">Preview</Label>
                <div className="bg-foreground rounded-2xl p-2 max-w-xs mx-auto">
                  <div className="bg-card rounded-xl overflow-hidden">
                    {navigationType === "drawer" ? (
                      // Drawer Preview
                      <div className="flex">
                        <div className="w-2/3 bg-card border-r border-border p-3">
                          <div className="space-y-2">
                            {navItems.slice(0, 8).map((item) => {
                              const IconComponent = iconOptions.find(
                                (opt) => opt.value === item.icon
                              )?.icon || Home;
                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50"
                                >
                                  <IconComponent className="w-5 h-5 text-muted-foreground" />
                                  <span className="text-sm">
                                    {item.label || "Menu Item"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="w-1/3 bg-muted/50 h-48" />
                      </div>
                    ) : (
                      // Tabs Preview
                      <>
                        <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5" />
                        <div className="flex items-center justify-around p-3 border-t border-border">
                          {navItems.slice(0, 5).map((item) => {
                            const IconComponent = iconOptions.find(
                              (opt) => opt.value === item.icon
                            )?.icon || Home;
                            return (
                              <div
                                key={item.id}
                                className="flex flex-col items-center gap-1"
                              >
                                <IconComponent className="w-5 h-5 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">
                                  {item.label || "Tab"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NavigationStep;
