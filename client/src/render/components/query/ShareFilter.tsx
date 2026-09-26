import { compress, Compressed, decompress } from "compress-json";
import { ClipboardPaste, Copy } from "lucide-react";
import React from "react";
import { toast } from "react-toastify";
import { Node } from "../../../models/filter";
import { Button } from "../ui/Button";

interface ShareFilterProps {
  tree: Node;
  onLoad: (tree: Node) => void;
}

// The format is shared between users, keep it compatible with older versions of the app
const encode = (tree: Node) => window.btoa(unescape(encodeURIComponent(JSON.stringify(compress(tree)))));
const decode = (text: string) => {
  const binary = window.atob(text.trim());
  let json: string;
  try {
    json = decodeURIComponent(escape(binary));
  } catch {
    // Filters copied by older versions weren't UTF-8 encoded
    json = binary;
  }
  return decompress(JSON.parse(json) as Compressed) as Node;
};

export const ShareFilter = ({ tree, onLoad }: ShareFilterProps) => {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(encode(tree));
      toast.success("Filter copied, share it with anyone");
    } catch {
      toast.error("Couldn't copy the filter");
    }
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast.error("Your clipboard is empty");
        return;
      }
      const decoded = decode(text);
      if (!decoded?.group || !Array.isArray(decoded.group.children)) throw new Error("Not a filter");
      onLoad(decoded);
      toast.success("Filter loaded from clipboard");
    } catch {
      toast.error("That doesn't look like a copied filter");
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" icon={Copy} onClick={copy}>
        Copy filter
      </Button>
      <Button variant="ghost" size="sm" icon={ClipboardPaste} onClick={paste}>
        Paste
      </Button>
    </>
  );
};
