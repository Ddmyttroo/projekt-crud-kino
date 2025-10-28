Projekt CRUD Kino

To aplikacja do zarządzania bazą danych filmów. Umożliwia wykonywanie operacji CRUD (tworzenie, odczyt, aktualizacja, usuwanie) na danych filmowych.

Funkcje

Operacje CRUD na filmach.

Node.js jako backend.

SQLite jako baza danych.

Prosty interfejs do zarządzania danymi.

Uruchamianie aplikacji

Uruchom aplikację za pomocą pliku RunAll.bat:
Wystarczy uruchomić plik RunAll.bat, aby uruchomić aplikację. Plik ten automatycznie:

Instaluje wszystkie zależności.

Uruchamia serwer.

Dostępność aplikacji:
Po uruchomieniu aplikacji będzie ona dostępna pod adresem http://localhost:3000.

Struktura projektu

server.js: Główny plik serwera, który zarządza aplikacją.

db.js: Plik konfiguracyjny bazy danych SQLite.

migrations/: Folder zawierający migracje bazy danych.

public/: Folder ze statycznymi plikami (CSS, obrazy).

tools/: Narzędzia pomocnicze.

data/: Folder z plikami bazy danych.

Ważne pliki

.env: Plik konfiguracyjny dla środowiska, zawierający ustawienia bazy danych.

package.json: Definicja zależności oraz skryptów do uruchamiania projektu (ale nie musisz go używać, ponieważ plik RunAll.bat wykonuje wszystkie potrzebne kroki).

RunAll.bat: Plik wsadowy do uruchamiania aplikacji i jej serwera oraz instalowania zależności.

README.md: Dokumentacja projektu.

Uwagi

W przypadku problemów z uruchomieniem aplikacji sprawdź, czy masz odpowiednie środowisko Node.js.

Jeśli chcesz pracować nad projektem, upewnij się, że masz odpowiednie środowisko Node.js 20.17.
