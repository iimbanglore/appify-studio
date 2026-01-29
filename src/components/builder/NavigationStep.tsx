import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Menu, Plus, Trash2, GripVertical, Home, User, Settings, Info, PanelLeft, LayoutGrid, Palette, ShoppingCart, Search, Bell, Heart, Mail, Calendar, Camera, Music, Video, Map, Phone, Star, Bookmark, Share2, Download, Upload } from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  url: string;
  icon: string;
  isExternal?: boolean;
}

export type NavigationType = "tabs" | "drawer";

export interface NavBarStyle {
  backgroundColor: string;
  activeIconColor: string;
  inactiveIconColor: string;
  activeTextColor: string;
  inactiveTextColor: string;
}

interface NavigationStepProps {
  enableNavigation: boolean;
  setEnableNavigation: (enabled: boolean) => void;
  navItems: NavItem[];
  setNavItems: (items: NavItem[]) => void;
  navigationType: NavigationType;
  setNavigationType: (type: NavigationType) => void;
  navBarStyle: NavBarStyle;
  setNavBarStyle: (style: NavBarStyle) => void;
}

const iconOptions = [
  { value: "home", icon: Home, label: "Home" },
  { value: "user", icon: User, label: "Profile" },
  { value: "settings", icon: Settings, label: "Settings" },
  { value: "info", icon: Info, label: "About" },
  { value: "menu", icon: Menu, label: "Menu" },
  { value: "cart", icon: ShoppingCart, label: "Cart" },
  { value: "search", icon: Search, label: "Search" },
  { value: "notifications", icon: Bell, label: "Notifications" },
  { value: "heart", icon: Heart, label: "Favorites" },
  { value: "mail", icon: Mail, label: "Messages" },
  { value: "calendar", icon: Calendar, label: "Calendar" },
  { value: "camera", icon: Camera, label: "Camera" },
  { value: "music", icon: Music, label: "Music" },
  { value: "video", icon: Video, label: "Video" },
  { value: "map", icon: Map, label: "Map" },
  { value: "phone", icon: Phone, label: "Phone" },
  { value: "star", icon: Star, label: "Star" },
  { value: "bookmark", icon: Bookmark, label: "Bookmark" },
  { value: "share", icon: Share2, label: "Share" },
  { value: "download", icon: Download, label: "Download" },
  { value: "upload", icon: Upload, label: "Upload" },
];

const presetColors = [
  { name: "Dark", bg: "#1a1a1a", activeIcon: "#007AFF", inactiveIcon: "#8E8E93", activeText: "#007AFF", inactiveText: "#8E8E93" },
  { name: "Light", bg: "#ffffff", activeIcon: "#007AFF", inactiveIcon: "#8E8E93", activeText: "#007AFF", inactiveText: "#8E8E93" },
  { name: "Blue", bg: "#1e3a5f", activeIcon: "#60a5fa", inactiveIcon: "#94a3b8", activeText: "#60a5fa", inactiveText: "#94a3b8" },
  { name: "Purple", bg: "#2d1b4e", activeIcon: "#a78bfa", inactiveIcon: "#9ca3af", activeText: "#a78bfa", inactiveText: "#9ca3af" },
  { name: "Green", bg: "#1a2e1a", activeIcon: "#4ade80", inactiveIcon: "#9ca3af", activeText: "#4ade80", inactiveText: "#9ca3af" },
  { name: "Orange", bg: "#2d1f0d", activeIcon: "#fb923c", inactiveIcon: "#9ca3af", activeText: "#fb923c", inactiveText: "#9ca3af" },
];

const NavigationStep = ({
  enableNavigation,
  setEnableNavigation,
  navItems,
  setNavItems,
  navigationType,
  setNavigationType,
  navBarStyle,
  setNavBarStyle,
}: NavigationStepProps) => {
  const [showAllIcons, setShowAllIcons] = useState<string | null>(null);

  const addNavItem = () => {
    const newItem: NavItem = {
      id: Date.now().toString(),
      label: "",
      url: "",
      icon: "home",
      isExternal: false,
    };
    setNavItems([...navItems, newItem]);
  };

  const updateNavItem = (id: string, field: keyof NavItem, value: string | boolean) => {
    setNavItems(
      navItems.map((item) => {
        if (item.id !== id) return item;
        if (field === "isExternal") {
          return { ...item, [field]: value === "true" || value === true };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const removeNavItem = (id: string) => {
    setNavItems(navItems.filter((item) => item.id !== id));
  };

  const applyPreset = (preset: typeof presetColors[0]) => {
    setNavBarStyle({
      backgroundColor: preset.bg,
      activeIconColor: preset.activeIcon,
      inactiveIconColor: preset.inactiveIcon,
      activeTextColor: preset.activeText,
      inactiveTextColor: preset.inactiveText,
    });
  };

  const updateStyle = (field: keyof NavBarStyle, value: string) => {
    setNavBarStyle({ ...navBarStyle, [field]: value });
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

            {/* Color Customization */}
            <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Palette className="w-5 h-5 text-primary" />
                <Label className="text-sm font-medium">Customize Colors</Label>
              </div>

              {/* Preset Themes */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-border hover:border-primary/50 transition-colors flex items-center gap-2"
                    >
                      <div
                        className="w-4 h-4 rounded-full border border-border"
                        style={{ backgroundColor: preset.bg }}
                      />
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Colors */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-xs">Background Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={navBarStyle.backgroundColor}
                      onChange={(e) => updateStyle("backgroundColor", e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0"
                    />
                    <Input
                      value={navBarStyle.backgroundColor}
                      onChange={(e) => updateStyle("backgroundColor", e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Active Icon Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={navBarStyle.activeIconColor}
                      onChange={(e) => updateStyle("activeIconColor", e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0"
                    />
                    <Input
                      value={navBarStyle.activeIconColor}
                      onChange={(e) => updateStyle("activeIconColor", e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Inactive Icon Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={navBarStyle.inactiveIconColor}
                      onChange={(e) => updateStyle("inactiveIconColor", e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0"
                    />
                    <Input
                      value={navBarStyle.inactiveIconColor}
                      onChange={(e) => updateStyle("inactiveIconColor", e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Active Text Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={navBarStyle.activeTextColor}
                      onChange={(e) => updateStyle("activeTextColor", e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0"
                    />
                    <Input
                      value={navBarStyle.activeTextColor}
                      onChange={(e) => updateStyle("activeTextColor", e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label className="text-xs">Inactive Text Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={navBarStyle.inactiveTextColor}
                      onChange={(e) => updateStyle("inactiveTextColor", e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0"
                    />
                    <Input
                      value={navBarStyle.inactiveTextColor}
                      onChange={(e) => updateStyle("inactiveTextColor", e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
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
                    {/* External Link Toggle */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`external-${item.id}`} className="text-xs font-medium cursor-pointer">
                          External Link
                        </Label>
                        <span className="text-[10px] text-muted-foreground">
                          (Opens in in-app browser)
                        </span>
                      </div>
                      <Switch
                        id={`external-${item.id}`}
                        checked={item.isExternal || false}
                        onCheckedChange={(checked) =>
                          updateNavItem(item.id, "isExternal", checked.toString())
                        }
                      />
                    </div>
                    
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
                        <Label className="text-xs">{item.isExternal ? "Full URL" : "URL Path"}</Label>
                        <Input
                          placeholder={item.isExternal ? "https://example.com" : "/home"}
                          value={item.url}
                          onChange={(e) =>
                            updateNavItem(item.id, "url", e.target.value)
                          }
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Icon</Label>
                        <button
                          onClick={() => setShowAllIcons(showAllIcons === item.id ? null : item.id)}
                          className="text-xs text-primary hover:underline"
                        >
                          {showAllIcons === item.id ? "Show less" : "Show all icons"}
                        </button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {(showAllIcons === item.id ? iconOptions : iconOptions.slice(0, 5)).map((opt) => (
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
                        <div 
                          className="w-2/3 p-3"
                          style={{ backgroundColor: navBarStyle.backgroundColor }}
                        >
                          <div className="space-y-2">
                            {navItems.slice(0, 8).map((item, idx) => {
                              const IconComponent = iconOptions.find(
                                (opt) => opt.value === item.icon
                              )?.icon || Home;
                              const isActive = idx === 0;
                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-3 p-2 rounded-lg"
                                  style={{
                                    backgroundColor: isActive ? `${navBarStyle.activeIconColor}20` : 'transparent',
                                  }}
                                >
                                  <IconComponent 
                                    className="w-5 h-5" 
                                    style={{ color: isActive ? navBarStyle.activeIconColor : navBarStyle.inactiveIconColor }}
                                  />
                                  <span 
                                    className="text-sm"
                                    style={{ color: isActive ? navBarStyle.activeTextColor : navBarStyle.inactiveTextColor }}
                                  >
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
                        <div 
                          className="flex items-center justify-around p-3"
                          style={{ 
                            backgroundColor: navBarStyle.backgroundColor,
                            borderTop: `1px solid ${navBarStyle.inactiveIconColor}30`
                          }}
                        >
                          {navItems.slice(0, 5).map((item, idx) => {
                            const IconComponent = iconOptions.find(
                              (opt) => opt.value === item.icon
                            )?.icon || Home;
                            const isActive = idx === 0;
                            return (
                              <div
                                key={item.id}
                                className="flex flex-col items-center gap-1"
                              >
                                <IconComponent 
                                  className="w-5 h-5" 
                                  style={{ color: isActive ? navBarStyle.activeIconColor : navBarStyle.inactiveIconColor }}
                                />
                                <span 
                                  className="text-[10px]"
                                  style={{ color: isActive ? navBarStyle.activeTextColor : navBarStyle.inactiveTextColor }}
                                >
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
