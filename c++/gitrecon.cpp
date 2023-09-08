#include <iostream>
#include <curl/curl.h>
#include <nlohmann/json.hpp> // Include the nlohmann JSON library
#include <vector>
#include <algorithm>

using json = nlohmann::json;

size_t WriteCallback(void *contents, size_t size, size_t nmemb, void *userp)
{
    ((std::string *)userp)->append((char *)contents, size * nmemb);
    return size * nmemb;
}

std::string getEmailFromJson(const std::string &jsonData)
{
    try
    {
        json parsedJson = json::parse(jsonData);

        for (const auto &commit : parsedJson)
        {
            if (commit.contains("author") && commit["author"].contains("email"))
            {
                return commit["author"]["email"].get<std::string>();
            }
        }
    }
    catch (const std::exception &e)
    {
        std::cerr << "Error parsing JSON: " << e.what() << std::endl;
    }

    return "";
}

std::string sendGetRequest(const std::string &url)
{
    CURL *curl;
    CURLcode res;
    std::string readBuffer;

    curl_global_init(CURL_GLOBAL_DEFAULT);

    curl = curl_easy_init();
    if (curl)
    {
        struct curl_slist *headers = nullptr;

        headers = curl_slist_append(headers, "authority: api.github.com");
        headers = curl_slist_append(headers, "authority: api.github.com");
        headers = curl_slist_append(headers, "accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7");
        headers = curl_slist_append(headers, "accept-language: en-US,en;q=0.9");
        headers = curl_slist_append(headers, "cache-control: max-age=0");
        headers = curl_slist_append(headers, "if-modified-since: Thu, 24 Aug 2023 16:05:00 GMT");
        headers = curl_slist_append(headers, "if-none-match: W/\"8a62e2ac432fb453c925472806bfc494dd51043153771f6178d9d130816d764d\"");
        headers = curl_slist_append(headers, "sec-ch-ua: \"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"");
        headers = curl_slist_append(headers, "sec-ch-ua-mobile: ?0");
        headers = curl_slist_append(headers, "sec-ch-ua-platform: \"Linux\"");
        headers = curl_slist_append(headers, "sec-fetch-dest: document");
        headers = curl_slist_append(headers, "sec-fetch-mode: navigate");
        headers = curl_slist_append(headers, "sec-fetch-site: none");
        headers = curl_slist_append(headers, "sec-fetch-user: ?1");
        headers = curl_slist_append(headers, "upgrade-insecure-requests: 1");
        headers = curl_slist_append(headers, "user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36");

        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &readBuffer);

        res = curl_easy_perform(curl);
        if (res != CURLE_OK)
        {
            std::cerr << "curl_easy_perform() failed: " << curl_easy_strerror(res) << std::endl;
        }

        curl_easy_cleanup(curl);
        curl_slist_free_all(headers);
    }

    curl_global_cleanup();

    return readBuffer;
}

int main()
{
    std::cout << R"(
           ███   █████                                                   
          ░░░   ░░███                                                    
  ███████ ████  ███████   ████████   ██████   ██████   ██████  ████████  
 ███░░███░░███ ░░░███░   ░░███░░███ ███░░███ ███░░███ ███░░███░░███░░███ 
░███ ░███ ░███   ░███     ░███ ░░░ ░███████ ░███ ░░░ ░███ ░███ ░███ ░███ 
░███ ░███ ░███   ░███ ███ ░███     ░███░░░  ░███  ███░███ ░███ ░███ ░███ 
░░███████ █████  ░░█████  █████    ░░██████ ░░██████ ░░██████  ████ █████
 ░░░░░███░░░░░    ░░░░░  ░░░░░      ░░░░░░   ░░░░░░   ░░░░░░  ░░░░ ░░░░░ 
 ███ ░███                                                                
░░██████                                                                 
 ░░░░░░        https://github.com/atiilla
)" << std::endl;

    while (true)
    {
        std::string username;
        std::cout << "Enter GitHub username (or 'exit' to quit): ";
        std::cin >> username;

        if (username == "exit")
        {
            break;
        }

        std::string url = "https://api.github.com/users/" + username + "/events?per_page=100000";
        std::string jsonData = sendGetRequest(url);

        // json parse
        json parsedJson = json::parse(jsonData);

        // get email
        // emails array unique
        std::vector<std::string> emails;

        for (const auto &commit : parsedJson)
        {

            if (commit.contains("payload"))
            {
                if (commit["payload"].contains("commits"))
                {
                    emails.push_back(commit["payload"]["commits"][0]["author"]["email"]);

                    // unique emails
                    std::sort(emails.begin(), emails.end());
                    emails.erase(std::unique(emails.begin(), emails.end()), emails.end());
                }
            }
        }

        // print unique emails
        for (const auto &email : emails)
        {
            std::cout << email << std::endl;
        }
    }
    return 0;
}