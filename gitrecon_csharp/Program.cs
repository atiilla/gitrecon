using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using CommandLine;

class Program
{
    private const string API_URL = "https://api.github.com";
    private static readonly Dictionary<string, string> HEADER = new Dictionary<string, string>
    {
        { "Accept", "application/vnd.github.v3+json" },
        { "User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.141 Safari/537.36" }
    };
    private static readonly int DELAY = 3000; // Delay in milliseconds

    public class Options
    {
        [Option('u', "user", Required = true, HelpText = "Name of the user whose repositories should be scanned.")]
        public string User { get; set; }

        [Option('r', "repository", Required = false, HelpText = "Name of the repository which should be scanned.")]
        public string Repository { get; set; }

        [Option('t', "token", Required = false, HelpText = "GitHub API token to increase rate limits.")]
        public string Token { get; set; }

        [Option('n', "no-forks", Required = false, HelpText = "Do not scan forked repositories.")]
        public bool NoForks { get; set; }
    }

    static async Task Main(string[] args)
    {
        // Display the banner
    Console.WriteLine(@"
    ██████╗ ██╗████████╗██████╗ ███████╗ ██████╗ ██████╗ ███╗   ██╗
    ██╔════╝ ██║╚══██╔══╝██╔══██╗██╔════╝██╔════╝██╔═══██╗████╗  ██║
    ██║  ███╗██║   ██║   ██████╔╝█████╗  ██║     ██║   ██║██╔██╗ ██║
    ██║   ██║██║   ██║   ██╔══██╗██╔══╝  ██║     ██║   ██║██║╚██╗██║
    ╚██████╔╝██║   ██║   ██║  ██║███████╗╚██████╗╚██████╔╝██║ ╚████║
     ╚═════╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝
                                            https://github.com/atiilla
    ");
        await Parser.Default.ParseArguments<Options>(args).WithParsedAsync(async opts =>
        {
            // Add token to headers if provided
            if (!string.IsNullOrEmpty(opts.Token))
            {
                HEADER["Authorization"] = $"token {opts.Token}";
            }

            List<string> reposToScan = new List<string>();

            // If a specific repository is provided, scan that
            if (!string.IsNullOrEmpty(opts.Repository))
            {
                reposToScan.Add(opts.Repository);
            }
            else
            {
                // Get all repositories of the user
                Console.WriteLine($"Scanning all public repositories of {opts.User}");
                var repositories = await GetRepositories(opts.User);

                reposToScan = repositories
                    .Where(repo => !opts.NoForks || !repo.IsFork)
                    .Select(repo => repo.Name)
                    .ToList();

                Console.WriteLine($"Found {reposToScan.Count} public repositories.");
            }

            Dictionary<string, HashSet<string>> emailsToName = new Dictionary<string, HashSet<string>>();

            using HttpClient client = new HttpClient();
            try
            {
                foreach (var repo in reposToScan)
                {
                    Console.WriteLine($"Scanning repository: {repo}");
                    var emailsToNameNew = await GetEmails(client, opts.User, repo);

                    foreach (var (email, names) in emailsToNameNew)
                    {
                        if (!emailsToName.ContainsKey(email))
                        {
                            emailsToName[email] = new HashSet<string>();
                        }
                        foreach (var name in names)
                        {
                            emailsToName[email].Add(name);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"An error occurred: {ex.Message}");
            }

            if (emailsToName.Any())
            {
                var maxEmailWidth = emailsToName.Keys.Max(email => email.Length);
                Console.WriteLine($"Found the following emails:");
                foreach (var (email, names) in emailsToName)
                {
                    var namesString = string.Join("; ", names);
                    Console.WriteLine($"{email.PadRight(maxEmailWidth)} | {namesString}");
                }
            }
            else
            {
                Console.WriteLine("No emails found.");
            }
        });
    }

    private static async Task<List<Repository>> GetRepositories(string username)
    {
        using HttpClient client = new HttpClient();
        var repositories = new List<Repository>();
        var repositoriesSeen = new HashSet<string>();
        int pageCounter = 1;

        while (true)
        {
            var url = $"{API_URL}/users/{username}/repos?per_page=100&page={pageCounter}";
            var result = await ApiCall(client, url);

            if (result == null || result is JsonObject obj && obj.ContainsKey("message") && obj["message"]!.ToString() == "Not Found")

            {
                Console.WriteLine($"User '{username}' not found.");
                break;
            }

            foreach (var repo in result.AsArray())
            {
                var repoName = repo["name"]?.ToString();
                var isFork = repo["fork"]?.GetValue<bool>() ?? false;

                if (repositoriesSeen.Contains(repoName)) break;
                repositories.Add(new Repository(repoName, isFork));
                repositoriesSeen.Add(repoName);
            }

            if (result.AsArray().Count < 100) break;
            pageCounter++;
        }

        return repositories;
    }

    private static async Task<Dictionary<string, HashSet<string>>> GetEmails(HttpClient client, string username, string repoName)
    {
        var emailsToName = new Dictionary<string, HashSet<string>>();
        var seenCommits = new HashSet<string>();
        int pageCounter = 1;

        while (true)
        {
            var url = $"{API_URL}/repos/{username}/{repoName}/commits?per_page=100&page={pageCounter}";
            var result = await ApiCall(client, url);

            if (result == null || result is JsonObject obj && obj.ContainsKey("message") && obj["message"]!.ToString() == "Not Found")

            {
                Console.WriteLine($"Repository '{repoName}' not found.");
                return emailsToName;
            }

            foreach (var commit in result.AsArray())
            {
                var sha = commit["sha"]?.ToString();
                if (seenCommits.Contains(sha)) break;
                seenCommits.Add(sha);

                var author = commit["commit"]?["author"];
                var committer = commit["commit"]?["committer"];
                AddEmail(emailsToName, author);
                AddEmail(emailsToName, committer);
            }

            if (result.AsArray().Count < 100) break;
            pageCounter++;
        }

        return emailsToName;
    }

    private static void AddEmail(Dictionary<string, HashSet<string>> emailsToName, JsonNode author)
    {
        if (author == null) return;
        var email = author["email"]?.ToString();
        var name = author["name"]?.ToString();

        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(name)) return;

        if (!emailsToName.ContainsKey(email))
        {
            emailsToName[email] = new HashSet<string>();
        }
        emailsToName[email].Add(name);
    }

    private static async Task<JsonNode> ApiCall(HttpClient client, string url)
    {
        await Task.Delay(DELAY);
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        foreach (var header in HEADER)
        {
            request.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            Console.WriteLine($"API call failed: {response.StatusCode}");
            return null;
        }

        var content = await response.Content.ReadAsStringAsync();
        return JsonNode.Parse(content);
    }

    public class Repository
    {
        public string Name { get; }
        public bool IsFork { get; }

        public Repository(string name, bool isFork)
        {
            Name = name;
            IsFork = isFork;
        }
    }
}
