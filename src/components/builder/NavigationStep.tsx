import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Menu, Plus, Trash2, GripVertical, Home, User, Settings, Info } from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  url: string;
  icon: string;
}

interface NavigationStepProps {
  enableNavigation: boolean;
  setEnableNavigation: (enabled: boolean) => void;
  navItems: NavItem[];
  setNavItems: (items: NavItem[]) => void;
}

const iconOptions = [
  { value: "home", icon: Home },
  { value: "user", icon: User },
  { value: "settings", icon: Settings },
  { value: "info", icon: Info },
];

const NavigationStep = ({
  enableNavigation,
  setEnableNavigation,
  navItems,
  setNavItems,
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
          Add a bottom navigation bar to your app
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-6">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-accent/50">
          <div>
            <Label htmlFor="enable-nav" className="font-medium">
              Enable Bottom Navigation
            </Label>
            <p className="text-sm text-muted-foreground">
              Add a tab bar at the bottom of your app
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
            {/* Navigation Items */}
            <div className="space-y-3">
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
                      <div className="flex gap-2">
                        {iconOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => updateNavItem(item.id, "icon", opt.value)}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                              item.icon === opt.value
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                            }`}
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

            {navItems.length < 5 && (
              <Button
                variant="outline"
                onClick={addNavItem}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Navigation Item
              </Button>
            )}

            {/* Preview */}
            {navItems.length > 0 && (
              <div className="mt-8">
                <Label className="text-sm font-medium mb-3 block">Preview</Label>
                <div className="bg-foreground rounded-2xl p-2 max-w-xs mx-auto">
                  <div className="bg-card rounded-xl overflow-hidden">
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
