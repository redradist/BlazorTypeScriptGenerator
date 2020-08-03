using System.Text.Json.Serialization;


namespace BrowserInterop{% if browserInteropApi %}.{% endif %}{{browserInteropApi}}
{
    public class {{objectName}}
    {
        {%- for name, type in properties %}
          public {{ type }} {{ name[0].toUpperCase() +
                               name.slice(1) }} { get; set; }
        {%- endfor %}
    }
}
