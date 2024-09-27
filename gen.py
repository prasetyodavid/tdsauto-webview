import re
import subprocess

def to_pascal_case(s):
    """Convert a string to PascalCase."""
    return ''.join(word.capitalize() for word in s.split())

def replace_content_in_files(main_dart_path, manifest_path, gradle_path, kt_path):
    # Ask for new values from the user
    new_home_url = input("Enter new MAIN_HOME_URL: ")
    new_title = input("Enter new MAIN_TITLE: ")
    new_package_name = input("Enter new package name (e.g., com.example.myapp): ")

    apk_name = to_pascal_case(new_title) + ".apk"
    
    # 1. Update main.dart file
    with open(main_dart_path, 'r') as file:
        content = file.read()

    # Replace MAIN_HOME_URL and MAIN_TITLE in main.dart
    content = re.sub(r'var MAIN_HOME_URL = ".*?";', f'var MAIN_HOME_URL = "{new_home_url}";', content)
    content = re.sub(r'var MAIN_TITLE = ".*?";', f'var MAIN_TITLE = "{new_title}";', content)

    with open(main_dart_path, 'w') as file:
        file.write(content)

    print(f"main.dart updated successfully with MAIN_HOME_URL and MAIN_TITLE.")

    # 2. Update AndroidManifest.xml file
    with open(manifest_path, 'r') as file:
        manifest_content = file.read()

    # Replace android:label in AndroidManifest.xml
    manifest_content = re.sub(r'android:label=".*?"', f'android:label="{new_title}"', manifest_content)

    with open(manifest_path, 'w') as file:
        file.write(manifest_content)

    print(f"AndroidManifest.xml updated successfully with new android:label.")

    # 3. Update build.gradle file
    with open(gradle_path, 'r') as file:
        gradle_content = file.read()

    # Replace applicationId and namespace in build.gradle
    gradle_content = re.sub(r'applicationId ".*?"', f'applicationId "{new_package_name}"', gradle_content)
    gradle_content = re.sub(r'namespace ".*?"', f'namespace "{new_package_name}"', gradle_content)

    # Replace newApkName
    gradle_content = re.sub(r'def newApkName = ".*?"', f'def newApkName = "{apk_name}"', gradle_content)


    with open(gradle_path, 'w') as file:
        file.write(gradle_content)

    print(f"build.gradle updated successfully with new applicationId and namespace.")

    # 4. Update Kotlin file
    with open(kt_path, 'r') as file:
        kt_content = file.read()

    # Replace the package declaration in the Kotlin file
    kt_content = re.sub(r'package\s+.*', f'package {new_package_name}', kt_content)

    with open(kt_path, 'w') as file:
        file.write(kt_content)

    print(f"{kt_path} updated successfully with new package name.")

    # 5. Run Flutter commands
    try:
        print("Running Flutter commands...")
        subprocess.run(["cmd", "/c", ".\gen.bat"], check=True)

        print("Flutter commands executed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"Error running Flutter commands: {e}")

# Example usage
main_dart_file_path = 'lib/main.dart'  # Path to main.dart file
manifest_file_path = 'android/app/src/main/AndroidManifest.xml'  # Path to AndroidManifest.xml
gradle_file_path = 'android/app/build.gradle'  # Path to build.gradle
kt_path = 'android/app/src/main/kotlin/com/tdsautomart/tdsautomart/MainActivity.kt'  # Updated path

replace_content_in_files(main_dart_file_path, manifest_file_path, gradle_file_path, kt_path)
