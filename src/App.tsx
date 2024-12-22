import { useState, useEffect, useRef } from "react";
import { core } from "@tauri-apps/api";
import "./App.css";

type Keybind = {
  key: string;
  bind: string;
};

type KeybindFile = {
  name: string;
  keybinds: Keybind[];
};

function App() {
  const [files, setFiles] = useState<KeybindFile[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [searchText, setSearchText] = useState("");


  const searchInputRef = useRef<HTMLInputElement>(null);

  //useEffect(() => {
  //  async function loadCustomStyle() {
  //    try {
  //      const result: string | null = await core.invoke("get_custom_css");
  //      if (result) {
  //        const styleTag = document.createElement("style");
  //        styleTag.textContent = result;
  //        document.head.appendChild(styleTag);
  //      } else {
  //        console.warn("Custom style.css not found, using default styles.");
  //      }
  //    } catch (error) {
  //      console.error("Error fetching custom style.css:", error);
  //    }
  //  }
  //
  //  loadCustomStyle();
  //}, []);

  useEffect(() => {
    const incrementSelectedFileIndex = () => {
      //console.log(selectedFileIndex = ${ selectedFileIndex });
      //console.log(files.length = ${ files.length });
      setSelectedFileIndex((prevIndex) => {
        const newIndex = prevIndex === files.length - 1 ? 0 : prevIndex + 1;
        //console.log(New index: ${ newIndex });
        return newIndex;
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      console.log("Key pressed:", event.key);
      switch (event.key) {
        case "Escape": {
          core.invoke("exit_app");
          break;
        }
        case "Tab": {
          event.preventDefault();
          incrementSelectedFileIndex();
          break;
        }
        default: {
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [files.length]);

  useEffect(() => {
    core.invoke<[string, [string, string][]][]>('get_keybind_files')
      .then((result) => {
        const parsedFiles = result
          .map(([name, keybinds]) => ({
            name,
            keybinds: keybinds.map(([key, bind]) => ({ key, bind })),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setFiles(parsedFiles);
      })
      .catch((error) => console.error('Failed to load keybind files:', error));
  }, []);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const highlightText = (text: string, search: string) => {
    if (!search) return text;
    const searchTerms = search.toLowerCase().split(" ").filter(Boolean); // Split by spaces and remove empty terms
    const regex = new RegExp(`(${searchTerms.join("|")})`, "gi"); // Combine terms into one regex
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, idx) =>
          regex.test(part) ? (
            <span key={idx} className="highlight-text">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const filteredKeybinds = searchText
    ? files.flatMap((file) =>
      file.keybinds
        .filter((keybind) => {
          const searchTerms = searchText.toLowerCase().split(" ").filter(Boolean);
          return searchTerms.every((term) =>
            file.name.toLowerCase().includes(term) ||
            keybind.key.toLowerCase().includes(term) ||
            keybind.bind.toLowerCase().includes(term)
          );
        })
        .map((keybind) => ({ fileName: file.name, ...keybind }))
    )
    : [];

  const searchIcon = (
    <svg
      className="search-icon"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  )

  return (
    <main className="main-window">
      <div className="search-bar">
        <div className="search-container">
          {searchIcon}
          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={handleSearchChange}
            placeholder="Search keybinds..."
            className="search-input"
          />
        </div>
      </div>

      {searchText ? (
        <div>
          {filteredKeybinds.length > 0 ? (
            <div>
              <table className="keybind-table">
                <thead className="keybind-table-head">
                  <tr>
                    <th className="keybind-file-name">File Name</th>
                    <th className="keybind-name">Key</th>
                    <th className="keybind-binding">Binding</th>
                  </tr>
                </thead>
                <tbody className="file-content">
                  {filteredKeybinds.map(({ fileName, key, bind }, idx) => (
                    <tr key={idx} className="keybind-row">
                      <td className="keybind-file-name">{highlightText(fileName, searchText)}</td>
                      <td className="keybind-name">{highlightText(key, searchText)}</td>
                      <td className="keybind-binding">{highlightText(bind, searchText)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-results-container">
              <div className="no-results-header">
                <p className="no-results-text">No results for</p>
                <p className="search-term">'{searchText}'</p>
              </div>
              <p className="no-results-message">No filenames, actions, or keybinds match</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="tabs">
            {files.map((file, index) => (
              <button
                key={file.name}
                className={`tab ${selectedFileIndex === index ? "active-tab" : "inactive-tab"}`}
                onClick={() => setSelectedFileIndex(index)}
              >
                {file.name}
              </button>
            ))}
          </div>
          <div className="content">
            {files.length > 0 && (
              <div className="file-content">
                <table className="keybind-table">
                  <thead>
                    <tr className="keybind-row">
                      <th className="keybind-name">Key</th>
                      <th className="keybind-binding">Binding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files[selectedFileIndex]?.keybinds.map(({ key, bind }, idx) => (
                      <tr key={idx} className="keybind-row">
                        <td className="keybind-name">{key}</td>
                        <td className="keybind-binding">{bind}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}

export default App;
